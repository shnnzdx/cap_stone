# try this from browser - http://127.0.0.1:5000/addnumbers?num1=25&num2=57
# what happened? 
# Try it from postman


from flask import Flask, request

app = Flask(__name__)

@app.route("/")
def hello():
    return "Hello, World!"

@app.route("/addnumbers", methods=['POST'])
def addnumbers():
    num1 = request.form["num1"]
    num2 = request.form["num2"]
    
    # The request argument is string type so convert to int
    print("Type of num1: ", type(num1))
    return str(int(num1) + int(num2))

if __name__ == '__main__':
    app.run(debug=True) # Keeping debug true will help you during development
    #app.run(port=1050) to use custom port number