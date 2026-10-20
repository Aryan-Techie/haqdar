from tests.conftest import login


def test_saved_put_delete_list(client, auth):
    assert client.get("/me/saved", headers=auth).json() == {"scheme_ids": []}
    assert client.put("/me/saved/test-pension", headers=auth).status_code == 200
    assert client.put("/me/saved/test-pension", headers=auth).status_code == 200  # idempotent
    client.put("/me/saved/test-deadline", headers=auth)
    assert client.get("/me/saved", headers=auth).json() == {"scheme_ids": ["test-pension", "test-deadline"]}
    client.delete("/me/saved/test-pension", headers=auth)
    assert client.get("/me/saved", headers=auth).json() == {"scheme_ids": ["test-deadline"]}


def test_saved_unknown_scheme_404_and_auth(client, auth):
    assert client.put("/me/saved/nope", headers=auth).status_code == 404
    assert client.get("/me/saved").status_code == 401
    assert client.put("/me/saved/test-pension").status_code == 401


def test_saved_isolated_per_user(client):
    h1, _ = login(client, "9876543210")
    h2, _ = login(client, "9123456780")
    client.put("/me/saved/test-pension", headers=h1)
    assert client.get("/me/saved", headers=h2).json() == {"scheme_ids": []}
