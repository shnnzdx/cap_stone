from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flasgger import Swagger, swag_from

app = Flask(__name__)

# 🔧 Configure PostgreSQL connection
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:@localhost:5432/testdb'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# 🔌 Initialize DB and Swagger
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
@swag_from({
    'responses': {
        200: {
            'description': 'List of all users',
            'examples': {
                'application/json': [
                    {"id": 1, "name": "Alice", "email": "alice@example.com"}
                ]
            }
        }
    }
})
def get_users():
    users = User.query.all()
    return jsonify([{
        "id": user.id,
        "name": user.name,
        "email": user.email
    } for user in users])

@app.route('/users', methods=['POST'])
@swag_from({
    'parameters': [
        {
            'name': 'body',
            'in': 'body',
            'required': True,
            'schema': {
                'type': 'object',
                'properties': {
                    'name': {'type': 'string'},
                    'email': {'type': 'string'}
                },
                'required': ['name', 'email']
            }
        }
    ],
    'responses': {
        201: {
            'description': 'User created'
        }
    }
})
def create_user():
    data = request.get_json()
    new_user = User(name=data['name'], email=data['email'])
    db.session.add(new_user)
    db.session.commit()
    return jsonify({
        "message": "User created",
        "user": {"id": new_user.id, "name": new_user.name, "email": new_user.email}
    }), 201

@app.route('/users/<int:user_id>/orders', methods=['GET'])
@swag_from({
    'responses': {
        200: {
            'description': 'List of orders for a user',
            'examples': {
                'application/json': [
                    {"id": 1, "item": "Book", "amount": 15.99}
                ]
            }
        },
        404: {'description': 'User not found'}
    }
})
def get_user_orders(user_id):
    user = User.query.get_or_404(user_id)
    return jsonify([{
        "id": order.id,
        "item": order.item,
        "amount": order.amount
    } for order in user.orders])

@app.route('/orders', methods=['POST'])
@swag_from({
    'parameters': [
        {
            'name': 'body',
            'in': 'body',
            'required': True,
            'schema': {
                'type': 'object',
                'properties': {
                    'item': {'type': 'string'},
                    'amount': {'type': 'number'},
                    'user_id': {'type': 'integer'}
                },
                'required': ['item', 'amount', 'user_id']
            }
        }
    ],
    'responses': {
        201: {'description': 'Order created'},
        404: {'description': 'User not found'}
    }
})
def create_order():
    data = request.get_json()
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

# 🏁 Main entry
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)
