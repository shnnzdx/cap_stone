## Run python userlist_flask_version.py
# http://127.0.0.1:5000/users OR >curl http://localhost:5000/users
# http://127.0.0.1:5000/user/2 OR curl http://127.0.0.1:5000/user/2 
# curl http://127.0.0.1:5000/user/Amul -X POST -v OR POSTMAN
# 
from flask import Flask, jsonify

app = Flask(__name__)

usersList = ['Aaron', 'Bianca', 'Cat', 'Danny', 'Elena']

@app.route('/users', methods=['GET'])
def users():
    return jsonify({ 'users': [user for user in usersList] })

@app.route('/user/<int:id>', methods=['GET'])
def userById(id):
    return jsonify({ 'username': usersList[id]  })

@app.route('/user/<string:name>', methods=['GET'])
def getUserByName(name):
    # Show some user information
    return "Some info"

@app.route('/user/<string:name>', methods=['POST'])
def addUserByName(name):
    usersList.append(name)
    return jsonify({ 'message': 'New user added'  })

app.run(debug=True)