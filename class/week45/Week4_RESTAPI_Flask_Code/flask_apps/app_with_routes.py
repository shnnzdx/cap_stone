# save this as app.py
from flask import Flask

app = Flask(__name__)

@app.route("/")
def hello():
    return "Hello, World!"

@app.route("/addnumbers")
def addnumbers():
    num1 = 20
    num2 = 10
    return str(num1 + num2)

if __name__ == '__main__':
    app.run(debug=True, port=8085) # Keeping  debug true will help you during development
    #app.run()