# Try http://127.0.0.1:5000/apidocs/
from flask import Flask, request
app = Flask(__name__)

#TO generate UI for sending request via browser 
from flasgger import Swagger 
#Enable this app for swagger and it will auto generate UI
swagger = Swagger(app)

@app.route("/")
def hello():
    return "Hello, World!"

@app.route("/addnumbers", methods=['POST'])
def addnumbers():
    """ Example endpoint returning sum of two numbers
    ---
    parameters:
        - name: num1
          in: formData
          type: number
          required: true
        - name: num2
          in: formData
          type: number
          required: true
    """

    num1 = request.form["num1"]
    num2 = request.form["num2"]
    
    # The request argument is string type so convert to int
    print("Type of num1: ", type(num1))
    return str(int(num1) + int(num2))

@app.route("/getnumbers", methods=['GET'])
def getnumbers():
    """ Example endpoint returning sum of two numbers
    parameters:
        - name: num1
          in: formData
          type: number
          required: false
        
    """
    return str(45)

if __name__ == '__main__':
    app.run(debug=True) # Keeping debug true will help you during development
    #app.run(port=1050) to use custom port number