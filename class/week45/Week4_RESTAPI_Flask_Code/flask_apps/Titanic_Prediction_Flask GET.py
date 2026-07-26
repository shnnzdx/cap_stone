# -*- coding: utf-8 -*-
"""

@author: amulc
"""

from flask import Flask, request
#TO generate UI for sending request via browser 
from flasgger import Swagger 

import pickle
import pandas as pd

app = Flask(__name__)

#Enable this app for swagger and it will auto generate UI
swagger = Swagger(app)

@app.route('/titanic', methods=['GET'])
def predict_survival():
    #BELOW docstring lines are required to support swagger documentation
    """ Endpoint returning titanic survival prediction
    ---
    parameters:
        - name: pclass
          in: formData
          type: number
          required: true
        - name: sex
          in: formData
          type: string
          required: true
        - name: age
          in: formData
          type: number
          required: true
    """
    pclass = request.form["pclass"]
    sex = request.form["sex"]
    age = request.form["age"]

    in_param = pclass + " " + sex + " " + age
    print("Debug: Input params: ", in_param)

    sex = sex.lower() # Converting sex to lower case
    sex_num = 1 if sex=="male" else 0

    # Create a test dataframe to use for prediction - Column name has to be SAME as training set
    data = {'Pclass': [pclass], 'Sex': [sex_num],'Age': [age]}
    df_passenger = pd.DataFrame(data)
    print("-------- PD Dataframe for prediction: -------\n", df_passenger)
    
    # Load the pickled titanic model
    model_filename = "titanicsurvival_classification.pkl"

    # Load model from file - read mode
    with open(model_filename,'rb') as file:
      titanic_pickle_model = pickle.load(file)

    # Make prediction using the input data
    prediction = titanic_pickle_model.predict(df_passenger)
    print("Debug: Prediction: ", prediction)

    # Send the prediction as response - will need to convert number to string
    return str(prediction)

if __name__ == '__main__':
    app.run(debug=True)
    