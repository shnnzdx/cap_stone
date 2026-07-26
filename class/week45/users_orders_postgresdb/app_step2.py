# pip install flask flask_sqlalchemy psycopg2-binary
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:password@localhost:5432/testdb'
db = SQLAlchemy(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)

@app.route('/users', methods=['GET'])
def get_users():
    all_users = User.query.all()
    return jsonify([{"id": u.id, "name": u.name, "email": u.email} for u in all_users])

@app.route('/users', methods=['POST'])
def create_user():
    data = request.get_json()
    new_user = User(name=data['name'], email=data['email'])
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"message": "User added", "user": {"id": new_user.id, "name": new_user.name, "email": new_user.email}}), 201

if __name__ == '__main__':
    db.create_all()  # For demo; use migrations for real apps
    app.run(debug=True)
