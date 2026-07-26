# -*- coding: utf-8 -*-
"""

@author: amul
"""

from flask import Flask, request
#TO generate UI for sending request via browser
from flasgger import Swagger 

import pickle
import pandas as pd

app = Flask(__name__)

#Enable this app for swagger and it will auto generate UI
swagger = Swagger(app)

@app.route('/titanic_file', methods=['POST'])
def predict_survival_file():

    #BELOW docstring lines are required to support swagger documentation
    """ Endpoint returning titanic survival prediction
    ---
    parameters:
        - name: input_file
          in: formData
          type: file
          required: true
    """
    # Get the input file from the http request
    df_passenger = pd.read_csv(request.files.get("input_file"))
    
    # Convert Sex column to lower case to provide better user experience
    df_passenger["Sex"] = df_passenger["Sex"].str.lower()

    # Change sex from female/male to 0/1
    df_passenger["Sex"] = df_passenger["Sex"].apply(lambda sex:1 if sex=="male" else 0)

    # Load the pickled titanic model
    model_filename = "titanicsurvival_classification.pkl"

    # Load model from file - read mode
    with open(model_filename,'rb') as file:
      titanic_pickle_model = pickle.load(file)

    # Make prediction using the input data
    prediction = titanic_pickle_model.predict(df_passenger)
    print("Debug: Prediction: ", prediction)

    # Send the prediction as response - will need to convert number to string
    return str(list(prediction))

if __name__ == '__main__':
    app.run(debug=True)
    