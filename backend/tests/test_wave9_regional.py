"""Wave 9 — Regional Discovery Engine LATAM tests."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://future-core-5.preview.emergentagent.com').rstrip('/')

CO_SEEDS = {"alpina", "avianca", "bancolombia", "grupo-sura", "grupo-nutresa",
            "ecopetrol", "rappi", "universidad-nacional", "universidad-de-los-andes"}


# ----------------------- Regional helper unit tests -----------------------
class TestRegionalHelper:
    def test_region_score(self):
        from services.discovery.regional import region_score, regional_sort
        assert region_score('CO', 'CO') == 60
        assert region_score('MX', 'CO') == 25
        assert region_score('US', 'CO') == 15

    def test_regional_sort(self):
        from services.discovery.regional import regional_sort
        items = [{'country': 'US'}, {'country': 'CO'}, {'country': 'MX'}]
        result = regional_sort(items, 'CO')
        assert [x['country'] for x in result] == ['CO', 'MX', 'US']


# ----------------------- Discovery Related -----------------------
class TestDiscoveryRelated:
    def test_microsoft_related_with_co_query(self):
        r = requests.get(f"{BASE_URL}/api/discovery/entity/microsoft/related?country=CO", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data.get('user_country') == 'CO'
        similar = data.get('similar', [])
        assert len(similar) > 0
        # First few must be CO seeds
        first_slugs = [s.get('slug') or s.get('id') or s.get('key') for s in similar[:9]]
        co_at_top = [s for s in first_slugs if s in CO_SEEDS]
        # At least first CO seed appears before any non-CO
        first_country = similar[0].get('country') or (similar[0].get('meta') or {}).get('country')
        assert first_country == 'CO', f"first similar not CO: {similar[0]}"

    def test_microsoft_related_via_accept_language(self):
        r = requests.get(f"{BASE_URL}/api/discovery/entity/microsoft/related",
                         headers={"Accept-Language": "es-CO"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data.get('user_country') == 'CO'
        similar = data.get('similar', [])
        first_country = similar[0].get('country') or (similar[0].get('meta') or {}).get('country')
        assert first_country == 'CO'

    def test_microsoft_related_no_country(self):
        r = requests.get(f"{BASE_URL}/api/discovery/entity/microsoft/related", timeout=30)
        assert r.status_code == 200
        data = r.json()
        # No reorder: user_country should be None/empty
        uc = data.get('user_country')
        assert uc in (None, "", "GLOBAL")


# ----------------------- Trending scopes -----------------------
class TestTrendingScopes:
    def test_trending_country_scope(self):
        r = requests.get(f"{BASE_URL}/api/discovery/trending?country=CO&scope=country&limit=6", timeout=30)
        assert r.status_code == 200
        items = r.json().get('items', [])
        assert len(items) > 0
        for it in items:
            c = it.get('country') or (it.get('meta') or {}).get('country')
            assert c == 'CO', f"non-CO item in country scope: {it}"
            assert it.get('regional_weight') == 1.0

    def test_trending_latam_scope(self):
        r = requests.get(f"{BASE_URL}/api/discovery/trending?country=CO&scope=latam&limit=20", timeout=30)
        assert r.status_code == 200
        items = r.json().get('items', [])
        assert len(items) > 0
        latam = {"AR","BO","BR","CL","CO","CR","CU","DO","EC","SV","GT","HN","MX","NI","PA","PY","PE","UY","VE","ES"}
        for it in items:
            c = it.get('country') or (it.get('meta') or {}).get('country')
            if c:
                assert c in latam, f"non-LATAM item: {c}"

    def test_trending_global_excludes_co(self):
        r = requests.get(f"{BASE_URL}/api/discovery/trending?country=CO&scope=global&limit=20", timeout=30)
        assert r.status_code == 200
        items = r.json().get('items', [])
        for it in items:
            c = it.get('country') or (it.get('meta') or {}).get('country')
            assert c != 'CO', f"CO item in global scope: {it}"

    def test_trending_scope_all_boosted(self):
        r = requests.get(f"{BASE_URL}/api/discovery/trending?country=CO&scope=all&limit=20", timeout=30)
        assert r.status_code == 200
        items = r.json().get('items', [])
        assert len(items) > 0
        # scope=all mixes and boosts by regional_weight — effective score should be non-increasing
        scores = [it.get('score', 0) for it in items]
        assert scores == sorted(scores, reverse=True), f"score not desc: {scores}"
        # first item must be from country tier (weight 1.0) since CO has seeds
        assert items[0].get('regional_weight') == 1.0

    def test_trending_no_country(self):
        r = requests.get(f"{BASE_URL}/api/discovery/trending?limit=6", timeout=30)
        assert r.status_code == 200
        items = r.json().get('items', [])
        assert len(items) > 0
        for it in items:
            assert 'base_score' in it
            assert abs(it.get('regional_weight', 0) - 1.0) < 0.01


# ----------------------- Search regional -----------------------
class TestSearchRegional:
    def test_search_with_es_co_header(self):
        r = requests.get(f"{BASE_URL}/api/search?q=colombia&types=companies&limit=8",
                         headers={"Accept-Language": "es-CO"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        companies = (data.get('by_type') or {}).get('companies') or data.get('companies') or []
        assert len(companies) >= 1
        first_six = companies[:6]
        for c in first_six:
            country = c.get('country') or (c.get('meta') or {}).get('country')
            assert country == 'CO', f"non-CO in first 6: {c}"


# ----------------------- Suggested -----------------------
class TestSuggested:
    def test_suggested_co(self):
        r = requests.get(f"{BASE_URL}/api/discovery/suggested?country=CO&limit=8", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data.get('user_country') == 'CO'
        items = data.get('items') or data.get('suggested') or []
        slugs = [i.get('slug') or i.get('id') or i.get('key') for i in items]
        # At least one of Bancolombia / Grupo SURA present
        assert any(s in slugs for s in ('bancolombia', 'grupo-sura', 'grupo-nutresa', 'ecopetrol')), f"no CO seed in suggested: {slugs}"


# ----------------------- Colombian companies seeded -----------------------
class TestCoCompaniesSeeded:
    @pytest.mark.parametrize("slug", ["bancolombia", "grupo-sura", "grupo-nutresa",
                                       "ecopetrol", "alpina", "avianca"])
    def test_co_company(self, slug):
        r = requests.get(f"{BASE_URL}/api/companies/{slug}", timeout=15)
        assert r.status_code == 200, f"{slug} failed: {r.status_code}"
        data = r.json()
        c = data.get('country') or (data.get('meta') or {}).get('country')
        assert c == 'CO', f"{slug} country={c}"

    def test_companies_list_country_co(self):
        r = requests.get(f"{BASE_URL}/api/companies?country=CO&limit=20", timeout=15)
        assert r.status_code == 200
        data = r.json()
        items = data if isinstance(data, list) else data.get('items') or data.get('companies') or []
        slugs = {i.get('slug') for i in items}
        expected = {'bancolombia', 'grupo-sura', 'grupo-nutresa', 'ecopetrol',
                    'alpina', 'avianca', 'rappi'}
        missing = expected - slugs
        assert not missing, f"missing CO companies: {missing}. found: {slugs}"


# ----------------------- CO sources seeded -----------------------
class TestCoSources:
    def test_co_sources(self):
        r = requests.get(f"{BASE_URL}/api/growth/sources", timeout=15)
        assert r.status_code == 200
        data = r.json()
        items = data if isinstance(data, list) else data.get('items') or data.get('sources') or []
        ids = {i.get('id') or i.get('key') for i in items}
        expected = {"co-eltiempo", "co-larepublica", "co-portafolio", "co-semana",
                    "co-mintic", "co-supersociedades", "co-ccb"}
        missing = expected - ids
        assert not missing, f"missing CO sources: {missing}"
        # Each expected has country CO
        for it in items:
            if (it.get('id') or it.get('key')) in expected:
                assert (it.get('country') or 'CO') == 'CO'


# ----------------------- User region PATCH -----------------------
class TestUserRegionPatch:
    def _login(self):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/community/auth/login",
                   json={"email": "member.demo@puntocero.test-e2e.com",
                         "password": "MemberDemo2026"}, timeout=15)
        assert r.status_code == 200, r.text
        return s

    def test_patch_region_valid(self):
        s = self._login()
        r = s.patch(f"{BASE_URL}/api/community/auth/me/region",
                    json={"country": "CO"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get('country') == 'CO'
        me = s.get(f"{BASE_URL}/api/community/auth/me", timeout=15)
        assert me.status_code == 200
        assert me.json().get('country') == 'CO'

    def test_patch_region_invalid(self):
        s = self._login()
        r = s.patch(f"{BASE_URL}/api/community/auth/me/region",
                    json={"country": "ZZ"}, timeout=15)
        assert r.status_code == 422, f"expected 422 got {r.status_code}: {r.text}"

    def test_patch_all_latam_codes(self):
        s = self._login()
        codes = ["AR","BO","BR","CL","CO","CR","CU","DO","EC","SV","GT",
                 "HN","MX","NI","PA","PY","PE","UY","VE","ES","US"]
        failed = []
        for c in codes:
            r = s.patch(f"{BASE_URL}/api/community/auth/me/region",
                        json={"country": c}, timeout=15)
            if r.status_code != 200:
                failed.append((c, r.status_code))
        assert not failed, f"rejected codes: {failed}"

    def test_e2e_logged_in_uses_user_country(self):
        s = self._login()
        s.patch(f"{BASE_URL}/api/community/auth/me/region",
                json={"country": "CO"}, timeout=15)
        r = s.get(f"{BASE_URL}/api/discovery/entity/microsoft/related", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data.get('user_country') == 'CO', f"user_country not CO: {data.get('user_country')}"


# ----------------------- Regression -----------------------
class TestRegression:
    def test_community_stats(self):
        r = requests.get(f"{BASE_URL}/api/community/stats", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert 'total_members' in d and 'total_companies' in d

    def test_mongodb_related(self):
        r = requests.get(f"{BASE_URL}/api/discovery/entity/mongodb/related", timeout=30)
        assert r.status_code == 200

    def test_google_related(self):
        r = requests.get(f"{BASE_URL}/api/discovery/entity/google/related", timeout=30)
        assert r.status_code == 200

    def test_bancolombia_related(self):
        r = requests.get(f"{BASE_URL}/api/discovery/entity/bancolombia/related", timeout=30)
        assert r.status_code == 200
        d = r.json()
        similar = d.get('similar', [])
        # Should include some CO seeds
        slugs = [s.get('slug') for s in similar]
        assert any(s in CO_SEEDS for s in slugs), f"no CO seeds in bancolombia similar: {slugs}"
