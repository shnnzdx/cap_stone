from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import IntegrityError
from flasgger import Swagger, swag_from

app = Flask(__name__)

# 🔧 PostgreSQL connection config
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:@localhost:5432/testdb'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
swagger = Swagger(app)

# 🧑 User model
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    orders = db.relationship('Order', backref='user', lazy=True)

# 📦 Order model
class Order(db.Model):
    __tablename__ = 'orders'
    id = db.Column(db.Integer, primary_key=True)
    item = db.Column(db.String(100), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

# ✅ Routes

@app.route('/users', methods=['GET'])
@swag_from({...})  # Swagger omitted for brevity
def get_users():
    try:
        users = User.query.all()
        return jsonify([{"id": u.id, "name": u.name, "email": u.email} for u in users])
    except Exception as e:
        return jsonify({"error": "Failed to fetch users", "details": str(e)}), 500

@app.route('/users', methods=['POST'])
@swag_from({...})  # Swagger omitted for brevity
def create_user():
    data = request.get_json()
    if not data or 'name' not in data or 'email' not in data:
        return jsonify({"error": "Missing 'name' or 'email' in request"}), 400
    try:
        new_user = User(name=data['name'], email=data['email'])
        db.session.add(new_user)
        db.session.commit()
        return jsonify({
            "message": "User created",
            "user": {"id": new_user.id, "name": new_user.name, "email": new_user.email}
        }), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Email already exists"}), 409
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to create user", "details": str(e)}), 500

@app.route('/users/<int:user_id>/orders', methods=['GET'])
@swag_from({...})  # Swagger omitted for brevity
def get_user_orders(user_id):
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404
        return jsonify([{"id": o.id, "item": o.item, "amount": o.amount} for o in user.orders])
    except Exception as e:
        return jsonify({"error": "Failed to retrieve orders", "details": str(e)}), 500

@app.route('/orders', methods=['POST'])
@swag_from({...})  # Swagger omitted for brevity
def create_order():
    data = request.get_json()
    if not data or 'item' not in data or 'amount' not in data or 'user_id' not in data:
        return jsonify({"error": "Missing fields: item, amount, user_id"}), 400
    try:
        user = User.query.get(data['user_id'])
        if not user:
            return jsonify({"error": "User not found"}), 404
        new_order = Order(item=data['item'], amount=data['amount'], user_id=data['user_id'])
        db.session.add(new_order)
        db.session.commit()
        return jsonify({
            "message": "Order created",
            "order": {"id": new_order.id, "item": new_order.item, "amount": new_order.amount}
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to create order", "details": str(e)}), 500

# 🔥 Global error handlers

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Resource not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500

# 🏁 Main entry
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)
