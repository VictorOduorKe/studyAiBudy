# backend installation process
# environments
~~~bash linux
python3 -m venv venv
source venv/bin/activate
~~~
~~~bash windows
python3 -m venv venv
venv\Scripts\activate
~~~

# dependancies
~~~bash
pip install flask flask-cors flask-mysql-connector flask-jwt-extended openai
~~~

flask → web framework

flask-cors → allows frontend (HTML/JS) to call backend

flask-mysql-connector → connect to MySQL

flask-jwt-extended → handle login & authentication with tokens

openai → talk to OpenAI API (for notes/quiz generation)

# openAI setup
~~~bash installing openAI/HuggingFace and dotenv
pip install openai
pip install python-dotenv

pip install transformers huggingface_hub requests




