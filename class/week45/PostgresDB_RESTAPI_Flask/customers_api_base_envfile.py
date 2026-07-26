from flask import Flask, request, jsonify
import os
from dotenv import load_dotenv

# Load environment variables 
load_dotenv()

# Initialize flask app
app = Flask(__name__)

# Create a Customer
@app.route('/customer', methods=['POST'])
def add_customer():
  name = request.json['name']
  address = request.json['address']
  age = request.json['age']
  height = request.json['height']
  email = request.json['email']
  api_version = os.environ['API_VERSION']

  new_customer = { "name": name, "address": address, "age": age, "height": height, "email": email, "api_version": api_version}

  return jsonify(new_customer)

# Run Server
if __name__ == '__main__':
  app.run(debug=True)