# Update Flask app to accept input from the user (default http GET)
# TO Restart the flask app (Ctrl+C) then “python filename.py”
# GO to the browser and enter the flask URL with arguments 
# Example: http://127.0.0.1:5000/addnumbers?num1=25&num2=57
# You should see the result of the addition in the browser.  
# Change the numbers and try again. NOTE: & is used to separate arguments
## NOTE: We have addred import for request to get data from request


from flask import Flask, request

app = Flask(__name__)

@app.route("/")
def hello():
    return "Hello, World!"

@app.route("/addnumbers")
def addnumbers():
    num1 = request.args.get("num1")
    num2 = request.args.get("num2")
    
    # The request argument is string type so convert to int
    print("Type of num1: ", type(num1))
    return str(int(num1) + int(num2))

if __name__ == '__main__':
    app.run(debug=True) # Keeping debug true will help you during development
    #app.run()