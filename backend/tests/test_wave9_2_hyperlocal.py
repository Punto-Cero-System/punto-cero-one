"""Wave 9.2 — Hyperlocal Discovery Engine tests (city → country → LATAM → global)."""
import os
import sys
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://future-core-5.preview.emergentagent.com').rstrip('/')

sys.path.insert(0, '/app/backend')


# ---------- Regional helper unit tests ----------
class TestRegionalHelperCity:
    def test_region_score_city_boost(self):
        from services.discovery.regional import region_score
        s = region_score('CO', 'CO', item_city='Medellín', user_city='Medellín')
        assert s == 90.0, f"expected 90 (60*1.5), got {s}"

    def test_region_score_country_no_city_match(self):
        from services.discovery.regional import region_score
        assert region_score('CO', 'CO', item_city='Bogotá', user_city='Medellín') == 60.0

    def test_hyperlocal_tier_country_when_city_differs(self):
        from services.discovery.regional import hyperlocal_tier
        assert hyperlocal_tier('CO', 'Bogotá', 'CO', 'Medellín') == 'country'

    def test_hyperlocal_tier_city_match(self):
        from services.discovery.regional import hyperlocal_tier
        assert hyperlocal_tier('CO', 'medellín', 'CO', 'MEDELLÍN') == 'city'

    def test_regional_sort_hyperlocal(self):
        from services.discovery.regional import regional_sort
        items = [
            {'country': 'CO', 'city': 'Bogotá', 'slug': 'bog'},
            {'country': 'CO', 'city': 'Medellín', 'slug': 'med'},
            {'country': 'US', 'slug': 'us'},
        ]
        result = regional_sort(items, 'CO', user_city='Medellín')
        assert result[0]['slug'] == 'med'
        assert result[1]['slug'] == 'bog'
        assert result[2]['slug'] == 'us'


# ---------- Discovery /related hyperlocal ----------
class TestHyperlocalDiscoveryRelated:
    def test_related_with_city_medellin(self):
        r = requests.get(f"{BASE_URL}/api/discovery/entity/bancolombia/related",
                         headers={'X-Region-Country': 'CO', 'X-Region-City': 'Medellín'}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data.get('user_country') == 'CO'
        assert data.get('user_city') == 'Medellín'
        sim = data.get('similar') or []
        assert len(sim) > 0
        top = sim[0]
        assert top.get('country') == 'CO'
        assert (top.get('city') or '').lower() == 'medellín', f"expected Medellín top, got {top.get('slug')}/{top.get('city')}"
        assert top.get('slug') in ('grupo-sura', 'grupo-nutresa', 'u-antioquia')

    def test_related_with_city_bogota(self):
        r = requests.get(f"{BASE_URL}/api/discovery/entity/bancolombia/related",
                         headers={'X-Region-Country': 'CO', 'X-Region-City': 'Bogotá'}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data['user_city'] == 'Bogotá'
        sim = data.get('similar') or []
        assert len(sim) > 0
        # Top similar should be a CO+Bogotá entity
        bogota_slugs = {'ecopetrol', 'avianca', 'mintic', 'sena', 'camara-comercio-bogota'}
        assert sim[0].get('slug') in bogota_slugs, f"expected Bogotá-based top, got {sim[0].get('slug')}"

    def test_related_without_city(self):
        r = requests.get(f"{BASE_URL}/api/discovery/entity/bancolombia/related",
                         headers={'X-Region-Country': 'CO'}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data['user_country'] == 'CO'
        assert data.get('user_city') in (None, '')
        sim = data.get('similar') or []
        # CO items should come first
        first_countries = [s.get('country') for s in sim[:3]]
        assert 'CO' in first_countries

    def test_city_query_override(self):
        r = requests.get(f"{BASE_URL}/api/discovery/entity/microsoft/related?country=CO&city=Medellín", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data['user_city'] == 'Medellín'
        assert data['user_country'] == 'CO'
        sim = data.get('similar') or []
        # first CO items in sim should be Medellín-based before Bogotá-based
        co_items = [s for s in sim if s.get('country') == 'CO']
        if len(co_items) >= 2:
            # find idx of first medellin & first bogota
            def _norm(x): return (x or '').strip().lower()
            med_idx = next((i for i, s in enumerate(co_items) if _norm(s.get('city')) == 'medellín'), None)
            bog_idx = next((i for i, s in enumerate(co_items) if _norm(s.get('city')) == 'bogotá'), None)
            if med_idx is not None and bog_idx is not None:
                assert med_idx < bog_idx, f"Medellín-based CO items should precede Bogotá-based (med={med_idx}, bog={bog_idx})"


# ---------- New CO institutions seeded ----------
class TestNewCoInstitutions:
    @pytest.mark.parametrize("slug,city", [
        ("sena", "Bogotá"), ("mintic", "Bogotá"),
        ("camara-comercio-bogota", "Bogotá"), ("u-antioquia", "Medellín"),
    ])
    def test_new_institution(self, slug, city):
        r = requests.get(f"{BASE_URL}/api/companies/{slug}", timeout=15)
        assert r.status_code == 200, f"{slug} not found"
        data = r.json()
        assert data.get('country') == 'CO'
        assert data.get('city') == city, f"{slug} city mismatch: got {data.get('city')}"

    def test_co_list_includes_new(self):
        r = requests.get(f"{BASE_URL}/api/companies?country=CO&limit=30", timeout=15)
        assert r.status_code == 200
        items = r.json().get('items') or []
        slugs = {i.get('slug') for i in items}
        for s in ('sena', 'mintic', 'camara-comercio-bogota', 'u-antioquia',
                  'bancolombia', 'grupo-sura', 'grupo-nutresa', 'ecopetrol', 'avianca'):
            assert s in slugs, f"CO list missing {s}"


class TestCoCompaniesCity:
    @pytest.mark.parametrize("slug,city", [
        ("bancolombia", "Medellín"), ("grupo-sura", "Medellín"), ("grupo-nutresa", "Medellín"),
        ("ecopetrol", "Bogotá"), ("avianca", "Bogotá"), ("alpina", "Sopó"),
    ])
    def test_city_field(self, slug, city):
        r = requests.get(f"{BASE_URL}/api/companies/{slug}", timeout=15)
        assert r.status_code == 200
        assert r.json().get('city') == city


# ---------- RSS sources ----------
class TestNewRssSources:
    NEW_SOURCES = ["ar-boletinoficial", "ar-bcra", "br-receita", "cl-bcentral",
                   "co-banrep", "co-superfinanciera", "mx-banxico", "pe-bcrp", "es-bde"]
    EXPECTED_COUNTRY = {"ar-boletinoficial": "AR", "ar-bcra": "AR", "br-receita": "BR",
                        "cl-bcentral": "CL", "co-banrep": "CO", "co-superfinanciera": "CO",
                        "mx-banxico": "MX", "pe-bcrp": "PE", "es-bde": "ES"}

    def test_sources_registered(self):
        r = requests.get(f"{BASE_URL}/api/growth/sources", timeout=15)
        assert r.status_code == 200
        payload = r.json()
        items = payload.get('items') or payload.get('sources') or (payload if isinstance(payload, list) else [])
        by_id = {s['id']: s for s in items if isinstance(s, dict) and 'id' in s}
        for sid in self.NEW_SOURCES:
            assert sid in by_id, f"source {sid} not registered"
            assert by_id[sid].get('country') == self.EXPECTED_COUNTRY[sid], \
                f"{sid} country mismatch: got {by_id[sid].get('country')}"


# ---------- Trending hyperlocal ----------
class TestTrendingHyperlocal:
    def test_trending_country_medellin(self):
        r = requests.get(f"{BASE_URL}/api/discovery/trending?scope=country&limit=20",
                         headers={'X-Region-Country': 'CO', 'X-Region-City': 'Medellín'}, timeout=30)
        assert r.status_code == 200
        items = r.json().get('items') or []
        # All CO items should have regional_weight ~ 1.0
        for it in items:
            if it.get('country') == 'CO':
                assert abs(it.get('regional_weight', 0) - 1.0) < 0.01


# ---------- Search regression ----------
class TestSearchRegression:
    def test_search_medellin(self):
        r = requests.get(f"{BASE_URL}/api/search?q=Medellín&types=companies",
                         headers={'X-Region-Country': 'CO'}, timeout=15)
        assert r.status_code == 200

    def test_search_colombia_es_co(self):
        r = requests.get(f"{BASE_URL}/api/search?q=Colombia&types=companies&limit=8",
                         headers={'Accept-Language': 'es-CO'}, timeout=15)
        assert r.status_code == 200


# ---------- PATCH /me/region with city ----------
def _login():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/community/auth/login",
               json={"email": "member.demo@puntocero.test-e2e.com", "password": "MemberDemo2026"},
               timeout=15)
    if r.status_code != 200:
        pytest.skip(f"login failed: {r.status_code} {r.text[:200]}")
    return s


class TestMeRegionCity:
    def test_patch_me_region_city(self):
        s = _login()
        r = s.patch(f"{BASE_URL}/api/community/auth/me/region",
                    json={"country": "CO", "city": "Medellín"}, timeout=15)
        assert r.status_code == 200, r.text[:200]
        data = r.json()
        assert data.get('country') == 'CO'
        assert data.get('city') == 'Medellín'
        # verify /me
        r2 = s.get(f"{BASE_URL}/api/community/auth/me", timeout=15)
        assert r2.status_code == 200
        me = r2.json()
        assert me.get('country') == 'CO'
        assert me.get('city') == 'Medellín'
        # subsequent related infers CO+Medellín
        r3 = s.get(f"{BASE_URL}/api/discovery/entity/microsoft/related", timeout=30)
        assert r3.status_code == 200
        d3 = r3.json()
        assert d3.get('user_country') == 'CO'
        assert d3.get('user_city') == 'Medellín'


# ---------- Region detect propagates city ----------
class TestRegionDetectCity:
    def test_detect_propagates_city(self):
        r = requests.get(f"{BASE_URL}/api/community/region/detect",
                         headers={'X-Forwarded-For': '190.85.107.5'}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get('country') == 'CO'
        # city should be present (Bogota-ish)
        assert data.get('city'), f"no city in response: {data}"
