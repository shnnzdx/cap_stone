from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)

# 🔧 Configure PostgreSQL connection
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:@localhost:5432/testdb'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# 🔌 Initialize DB
db = SQLAlchemy(app)

# 🧑 User model
class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    
    # Relationship to orders
    orders = db.relationship('Order', backref='user', lazy=True)

# 📦 Order model
class Order(db.Model):
    __tablename__ = 'orders'

    id = db.Column(db.Integer, primary_key=True)
    item = db.Column(db.String(100), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

# ✅ Routes

# Get all users
@app.route('/users', methods=['GET'])
def get_users():
    users = User.query.all()
    return jsonify([{
        "id": user.id,
        "name": user.name,
        "email": user.email
    } for user in users])

# Create a new user
@app.route('/users', methods=['POST'])
def create_user():
    data = request.get_json()
    new_user = User(name=data['name'], email=data['email'])
    db.session.add(new_user)
    db.session.commit()
    return jsonify({
        "message": "User created",
        "user": {"id": new_user.id, "name": new_user.name, "email": new_user.email}
    }), 201

# Get all orders for a user
@app.route('/users/<int:user_id>/orders', methods=['GET'])
def get_user_orders(user_id):
    user = User.query.get_or_404(user_id)
    return jsonify([{
        "id": order.id,
        "item": order.item,
        "amount": order.amount
    } for order in user.orders])

# Create a new order
@app.route('/orders', methods=['POST'])
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
    # Create tables only if they don't exist (for dev/demo use)
    with app.app_context():
        db.create_all()
    app.run(debug=True)


# Example cURL commands to test the API

# Add a user
# curl -X POST http://127.0.0.1:5000/users -H "Content-Type: application/json" -d '{"name": "Bob", "email": "bob@example.com"}'

# Get all users
# curl http://127.0.0.1:5000/users
# Add an order for user with id 1
# curl -X POST http://127.0.0.1:5000/orders -H "Content-Type: application/json" -d '{"item": "Book", "amount": 15.99, "user_id": 1}'

# Get orders for user 1
# curl http://127.0.0.1:5000/users/1/orders
