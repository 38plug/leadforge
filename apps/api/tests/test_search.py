def test_create_list_delete_saved_search(client, auth_headers):
    created = client.post(
        "/api/saved-searches",
        json={"name": "Berlin Dentists No Website", "filters": {"city": "Berlin", "niche": "Dentist"}},
        headers=auth_headers,
    )
    assert created.status_code == 201
    saved_id = created.json()["id"]

    listed = client.get("/api/saved-searches", headers=auth_headers)
    assert len(listed.json()) == 1

    deleted = client.delete(f"/api/saved-searches/{saved_id}", headers=auth_headers)
    assert deleted.status_code == 204

    listed_after = client.get("/api/saved-searches", headers=auth_headers)
    assert listed_after.json() == []


def test_search_history_starts_empty(client, auth_headers):
    response = client.get("/api/search-history", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []
