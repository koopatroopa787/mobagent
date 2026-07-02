from flask import Flask, jsonify, request

app = Flask(__name__)
items: list[dict] = []  # ponytail: in-memory only, reset on restart

@app.get("/items")
def list_items():
    return jsonify(items)

@app.post("/items")
def add_item():
    data = request.get_json()
    item = {"id": len(items) + 1, "text": data["text"], "done": False}
    items.append(item)
    return jsonify(item), 201

@app.get("/items/<int:item_id>")
def get_item(item_id: int):
    item = next((i for i in items if i["id"] == item_id), None)
    if not item:
        return jsonify({"error": "not found"}), 404
    return jsonify(item)

@app.patch("/items/<int:item_id>")
def update_item(item_id: int):
    item = next((i for i in items if i["id"] == item_id), None)
    if not item:
        return jsonify({"error": "not found"}), 404
    data = request.get_json()
    if "done" in data:
        item["done"] = data["done"]
    if "text" in data:
        item["text"] = data["text"]
    return jsonify(item)

@app.delete("/items/<int:item_id>")
def delete_item(item_id: int):
    global items
    before = len(items)
    items = [i for i in items if i["id"] != item_id]
    if len(items) == before:
        return jsonify({"error": "not found"}), 404
    return "", 204

if __name__ == "__main__":
    app.run(debug=True)
