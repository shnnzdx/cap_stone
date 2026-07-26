# NOTE 1: To connect with Azure Postgres use postgresql:// in connection string vs postgres://
## NOTE 2 - PUT THIS CODE IN app.py file
## Alternatively provide a startup file as per doc below 
# https://docs.microsoft.com/en-us/azure/developer/python/tutorial-deploy-app-service-on-linux-04
from flask import Flask, request, jsonify
import os
from dotenv import load_dotenv

from flask_sqlalchemy import SQLAlchemy
from flask_marshmallow import Marshmallow

# from product_api_sqlite import ProductSchema

# Load environment variables
load_dotenv()

# Initialize flask app
app = Flask(__name__)

basedir = os.path.abspath(os.path.dirname(__file__))
# Database
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ['POSTGRES_DB_CONNECTION_STRING']
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
ma = Marshmallow(app)

class Customer(db.Model):
  id = db.Column(db.Integer, primary_key=True)
  name = db.Column(db.String(80))
  description = db.Column(db.String(100))
  price = db.Column(db.Float)
  qty = db.Column(db.Integer)

  # define constructor
  def __init__(self, name, description, price, qty):
      self.name = name
      self.description = description
      self.price = price
      self.qty = qty

# Customer Schema
class CustomerSchema(ma.Schema):
  class Meta:
    fields = ('id', 'name', 'description', 'price', 'qty')
  
# Initialize customer schema
customer_schema = CustomerSchema()
customers_schema = CustomerSchema(many=True)

# Say hello for ping
@app.route('/sayhello', methods=['GET'])
def say_hello():
  hellomsg = {"msg": "Hello from API"}
  return jsonify(hellomsg)


# Create a Customer
@app.route('/customer', methods=['POST'])
def add_customer():
  name = request.json['name']
  description = request.json['description']
  price = request.json['price']
  qty = request.json['qty']  
  
  new_customer = Customer(name, description, price, qty)

  db.session.add(new_customer)
  db.session.commit()
  
  # return jsonify(new_customer)
  return customer_schema.jsonify(new_customer)


# Create a Customer
@app.route('/customer/<id>', methods=['PUT'])
def update_customer(id):
  name = request.json['name']
  description = request.json['description']
  price = request.json['price']
  qty = request.json['qty']  

  customer = Customer.query.get(id)
  
  customer.name = name
  customer.description = description
  customer.price = price
  customer.qty = qty

  db.session.commit()  
  return customer_schema.jsonify(customer)

# Get Customer
@app.route('/customer', methods=['GET'])
def get_customers():
  all_customers = Customer.query.all()
  result = customers_schema.dump(all_customers)
  return jsonify(result)

# Get Customer
@app.route('/customer/<id>', methods=['GET'])
def get_customer(id):
  customer = Customer.query.get(id)
  return customer_schema.jsonify(customer)

# Delete customer
@app.route('/customer/<id>', methods=['DELETE'])
def delete_customer(id):
  customer = Customer.query.get(id)
  db.session.delete(customer)
  db.session.commit()

  return customer_schema.jsonify(customer)

# Run Server
if __name__ == '__main__':
  app.run(debug=True)