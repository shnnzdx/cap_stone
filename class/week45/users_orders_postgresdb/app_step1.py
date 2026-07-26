from flask import Flask, request, jsonify

app = Flask(__name__)

users = []

@app.route('/users', methods=['GET'])
def get_users():
    return jsonify(users)

@app.route('/users', methods=['POST'])
def create_user():
    data = request.get_json()
    users.append(data)
    return jsonify({"message": "User added", "user": data}), 201

if __name__ == '__main__':
    app.run(debug=True)

# curl -X POST http://127.0.0.1:5000/users -H "Content-Type: application/json" -d '{"name": "Alice", "email": "alice@example.com"}'
# curl http://127.0.0.1:5000/users
