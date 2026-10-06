"""
Feed visibility — la autoridad única de "¿qué posts puede leer este viewer?".

OMEGA B4.1 — extracción puramente arquitectónica. Este módulo NO introduce
ninguna regla nueva: el código movido es el mismo, byte a byte, que A2 creó en
`feed_routes` y que A4.1 y B3 importaban desde allí. Moverlo no cambia una
sola condición de query.

POR QUÉ ESTE MÓDULO EXISTE
-------------------------
Hasta B4.1 la regla vivía en `routes/feed_routes.py`. Eso obligaba a que
cualquier otro endpoint que leyera `posts` —el Mixed Feed, la búsqueda global—
la importara desde una RUTA. Eso es una dependencia inversa: `services/` no
puede depender de `routes/` sin invertir la arquitectura, y `feed_engine`, que
es un servicio, necesitaría la regla para cerrar B4.

Con la regla aquí, la dependencia queda en un solo sentido:

    routes/  ──importa──▶  services/feed_visibility.py
    services/feed_engine/  ──importará──▶  services/feed_visibility.py   (B4)

REGLA DE ORO
------------
Una sola implementación. Si un endpoint/developa su propia condición de
visibilidad, las copias divergen y la fuga vuelve. Los consumidores deben
importar de aquí; no reimplementar.

QUÉ CONTIENE Y QUÉ NO
---------------------
Contiene las dos piezas del cálculo de grupo y su traducción a Mongo:
`_viewer_group_ids`, `_visibility_clause` y las constantes que comparten.

`_post_is_visible` (el espejo en memoria para la ruta de un post) se queda en
`feed_routes`: es un detalle de esa ruta, no parte de la autoridad compartida,
y moverlo ampliaría el alcance de este carril sin benefit. Si B4 lo necesita,
se moverá en su carril.
"""
from __future__ import annotations

from typing import Optional


#: visibilities que NO restringen la lectura. `unlisted` entra aquí a propósito:
#: el producto nunca le dio semántica, así que hoy se comporta como `public`.
#: Fijar un significado nuevo sería decisión de producto, no de este carril.
_UNRESTRICTED_VISIBILITIES = ["public", "unlisted", None]

#: visibility con alcance de grupo: exige pertenencia o propiedad.
_GROUP_SCOPED_VISIBILITY = "members"

__all__ = [
    "_visibility_clause",
    "_viewer_group_ids",
    "_UNRESTRICTED_VISIBILITIES",
    "_GROUP_SCOPED_VISIBILITY",
]


async def _viewer_group_ids(db, viewer: Optional[dict]) -> set:
    """Grupos en los que el viewer es miembro o administrador.

    Dos fuentes, igual que `group_permissions`: `group_members` para la
    pertenencia y `groups.admin_id` para la propiedad.

    Se resuelve a un `set` una sola vez por petición: un post del feed no
    puede consultar su grupo uno a uno dentro de un listado.
    """
    viewer_id = (viewer or {}).get("id")
    if not viewer_id:
        return set()
    ids: set = set()
    async for m in db.group_members.find({"user_id": viewer_id}, {"_id": 0, "group_id": 1}):
        gid = m.get("group_id")
        if gid:
            ids.add(gid)
    async for g in db.groups.find({"admin_id": viewer_id}, {"_id": 0, "id": 1}):
        if g.get("id"):
            ids.add(g["id"])
    return ids


def _visibility_clause(viewer_group_ids: set) -> dict:
    """La condición de visibilidad, como fragmento de query de Mongo.

    Se integra en la query —no se filtra en Python— porque filtrar después
    rompería la paginación: la página se llenaría con posts invisibles y el
    usuario vería huecos. La página se rellena solo con lo que puede leer.

    `$or` se usa aquí y no antes en la query porque el llamante puede haber
    construido la suya; cada consumidor la fusiona de forma explícita.
    """
    if not viewer_group_ids:
        # Sin relación con ningún grupo: solo lo no restringido. `follows` no
        # se consulta, así que un follower no entra por esta vía.
        return {"visibility": {"$in": list(_UNRESTRICTED_VISIBILITIES)}}

    return {
        "$or": [
            {"visibility": {"$in": list(_UNRESTRICTED_VISIBILITIES)}},
            # Pertenece o administra el grupo del post.
            {"visibility": _GROUP_SCOPED_VISIBILITY,
             "group_id": {"$in": sorted(viewer_group_ids)}},
        ]
    }
