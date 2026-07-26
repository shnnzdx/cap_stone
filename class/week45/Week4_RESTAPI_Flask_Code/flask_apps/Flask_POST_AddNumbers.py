# -*- coding: utf-8 -*-
"""

@author: amul
"""

from flask import Flask, request
#TO generate UI for sending request via browser
from flasgger import Swagger 
app = Flask(__name__)

#Enable this app for swagger and it will auto generate UI
swagger = Swagger(app)

@app.route('/add', methods=['POST'])
def add_numbers():
    #num1 = request.args.get("num1") - doesn't work with POST
    #num2 = request.args.get("num2") - doesn't work with POST
    #BELOW docstring lines are required to support swagger documentation
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
    
    #num1 & num2 are received as string so convert it to int for addition
    # and convert the result back to string as expected by flask
    return str(int(num1) + int(num2))

if __name__ == '__main__':
    app.run(debug=True)
    