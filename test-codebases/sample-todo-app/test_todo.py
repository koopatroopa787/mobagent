import pytest
from app import app, items

@pytest.fixture(autouse=True)
def reset():
    items.clear()
    yield
    items.clear()

@pytest.fixture
def client():
    app.config["TESTING"] = True
    return app.test_client()

def test_add_item(client):
    res = client.post("/items", json={"text": "buy milk"})
    assert res.status_code == 201
    assert res.json["text"] == "buy milk"
    assert res.json["done"] is False

def test_list_items(client):
    client.post("/items", json={"text": "a"})
    client.post("/items", json={"text": "b"})
    res = client.get("/items")
    assert res.status_code == 200
    assert len(res.json) == 2

def test_get_item(client):
    client.post("/items", json={"text": "first"})
    res = client.get("/items/1")
    assert res.status_code == 200
    assert res.json["text"] == "first"

def test_get_item_not_found(client):
    res = client.get("/items/99")
    assert res.status_code == 404

def test_mark_done(client):
    # Intentionally easy to break: change item["done"] = data["done"]
    # to item["done"] = False in app.py and this test fails cleanly.
    client.post("/items", json={"text": "task"})
    res = client.patch("/items/1", json={"done": True})
    assert res.status_code == 200
    assert res.json["done"] is True

def test_update_text(client):
    client.post("/items", json={"text": "old"})
    res = client.patch("/items/1", json={"text": "new"})
    assert res.status_code == 200
    assert res.json["text"] == "new"

def test_delete_item(client):
    client.post("/items", json={"text": "to delete"})
    res = client.delete("/items/1")
    assert res.status_code == 204
    assert client.get("/items/1").status_code == 404

def test_delete_not_found(client):
    res = client.delete("/items/99")
    assert res.status_code == 404
