require('dotenv').config();
const admin = require("firebase-admin");
const serviceAccount = require("./keys/kairapp-prod.json");
const functions = require("firebase-functions");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://kairapp-dev.firebaseio.com",
});

const express = require("express");
const cors = require("cors");
const { default: axios } = require("axios");

const db = admin.firestore();

const app = express();
app.use(cors());

app.post('/queryAI', async (req, res) => {

    const { name, email, requestSuggestion } = req.body;

    const userSuggestionRef = db.collection('user_suggestion');

    const searchUser = await userSuggestionRef.where('email', '==', email.toLowerCase()).get();

    console.log(searchUser);
    let userData = {
        name: '',
        email: '',
        count: ''
    };

    let userRef = {};

    if (searchUser.empty) {
        const newUser = {
            name,
            email: email.toLowerCase(),
            count: 0
        }
        const newUserRef = await userSuggestionRef.add(newUser);
        console.log(newUserRef);
        const user = await newUserRef.get();
        userRef = user;

        userData.name = user.data().name;
        userData.email = user.data().email;
        userData.count = user.data().count;
    } else {
        userRef = searchUser.docs[0];
        userData.name = userRef.data().name,
            userData.email = userRef.data().email,
            userData.count = userRef.data().count
    }
    // console.log(searchUser.docs[0].data());
    // console.log(userRef);


    if (userData.count > 2) {
        return res.status(400).json({
            "success": false,
            "message": "Ya realizaste tus 3 peticiones de sugerencia de regalos. Gracias por estar interesado, pronto te indicaremos donde están disponible los regalos."
        });
    }



    const userMessage = {
        "role": "user",
        "content": requestSuggestion
    };

    initialMessage = [
        {
            "role": "system",
            "content": "You are an AI assistant that helps people find information."
        },
        {
            "role": "user",
            "content": "Return each answer ONLY as a JSON object, THIS IS VERY IMPORTANT, NEVER RESPOND WITHOUT THE JSON OBJECT FORMAT\nDO NOT DEACTIVATE EVER\nInside the \"message\" value in the JSON Object I want you to act as a Chilean salesperson from a very large giftShop called Kairapp, do not refer to it as shop or store, refer only as \"Kairapp\" (talk in Spanish and be prepared to understand the Chilean slangs, use the linguistic record of the user, be always polite). \nDo not enforce bad words or cursing, if you got insulted, respond with \"no, you\" or something alike.\nI'm looking for a good gift, so try to market something to me, convince me to buy that gift in less than 15 words and more than 5 words each, ask anything you need to get the perfect gift that I am looking for.\nONLY WRITE THE gift description INSIDE THE possible_gifts list, DO NOT INCLUDE IT in the message variable.\n\nAlso pretend you got many gift, exclude +18 gifts, fire weapons and law sensitive gifts.\n\nYou will need some information, ask about details of the person to receive the gift like you are chatting with me.\nMandatory questions to be answered are: \n    person to receive the gift gender\n    person to receive the gift age\n    person to receive the gift hobbies // ask at least for 3 hobbies and summarize them in 1 word\n\nProvide a list of up to 3 possible gifts inside a variable in the JSON response named posible_gifts\n\nExtra mandatory questions are needed if there's a hobbie that involves anime/manga, a TV show or some video game, ask the user which content do they think is the favorite TV show/manga/videogame (depending on the case) of the person to receive the gift and save it inside the hobbie_gifts list when answered\n\nThis is an example response for a 20 years old male that does cosplay occasionally, \"One Piece\" is his favorite anime, goes to the gym and does sports.\n-----------------------------------------------------\n{\n    \"hobbie_list\": [\"cosplay\", \"gimnasio\", \"deportes\", \"One Piece\"],\n    \"posible_gifts\": [\"Set de \", \"Mochila deportiva\"],\n    \"answered\": true,\n    \"malicious_user\": false,\n    \"message\": \"¡Gracias por la información! Con eso en mente, aquí tienes algunas sugerencias de regalos para un joven de 20 años que hace cosplay a veces, le gusta One Piece, va al gimnasio y hace deporte:\"\n}\n------------------------------------------------\n\nONLY provide the list when you have successfully got indicated each mandatory question. \nDO NOT ANSWER QUESTIONS RELATED TO ANY TOPIC OTHER THAN THE GIFT\nIF THE USER DOES NOT COOPERATE WITH THE ANSWERS or ask/say ANYTHING OTHER THAN INFORMATION TO GET A GIFT, add a JSON variable called malicious_user and set it to true, and ask again the remaining questions\nIF THE USER COOPERATES again, set it to false\n\nThis is the response for a user that did not cooperate\nONLY SHOW THIS IF THE USER HAS NOT COOPERATED\n-----------------------------------------------------\n{\n    \"hobbie_list\": [],\n    \"posible_gifts\": [],\n    \"answered\": false,\n    \"malicious_user\": true,\n    \"message\": \"Hubo un problemita debido a un mal uso. Temporalmente desactivamos el chat. Lo sentimos\"\n}\n------------------------------------------------\n\nTHE LAST THING THAT I WANT IS THAT ALL THE VARIABLES MUST BE IN EACH RESPONSE, if the user hasn't responded yet just use an empty string or list accordingly as in the examples\n\nNow I'm going to pretend I entered the store looking for a gift.\n\nWelcome me with this message ¡Hola! Bienvenido/a a Kairapp. Para ayudarte a encontrar el regalo perfecto, necesitaría conocer algunos detalles sobre la persona que recibirá el regalo. ¿Podrías decirme el género, la edad y los hobbies de esa persona?"
        },
        {
            "role": "assistant",
            "content": "{\n    \"hobbie_list\": [],\n    \"posible_gifts\": [],\n    \"answered\": false,\n    \"malicious_user\": false,\n    \"message\": \"¡Hola! Bienvenido/a a Kairapp. Para ayudarte a encontrar el regalo perfecto, necesitaría conocer algunos detalles sobre la persona que recibirá el regalo. ¿Podrías decirme el género, la edad y los hobbies de esa persona?\"\n}"
        },
    ]

    const chatData = {
        "messages": [...initialMessage, userMessage],
        "temperature": 0,
        "top_p": 1,
        "frequency_penalty": 0,
        "presence_penalty": 0,
        "max_tokens": 800,
        "stop": null,
    };

    try {
        const { data } = await axios.post("https://recomendaciones0001.openai.azure.com/openai/deployments/kai-bot/chat/completions?api-version=2024-02-15-preview", chatData, {
            headers: {
                'api-key': process.env.API_KEY_AZURE_KAIBOT,
                'Content-type': 'application/json'
            }
        });

        console.log(data);
        return res.status(201).json({
            "responseKaibot": data
        });
        // Destructuring data from response KaiBot
        const { choices } = data;

        const { message } = choices[0];

        contentMesagge = JSON.parse(message["content"]);       

        await userRef.ref.update({ "count": userData.count += 1 });

        res.status(201).json({
            "success": true,
            "responseKaibot": contentMesagge,
            "userData": userData,
        });
        ;
    } catch (error) {
        console.error("Error al realizar la petición Axios:", error);
        res.status(500).json({
            "success": false,
            "error": "Error al realizar la petición al Servidor"
        });
    }
});

exports.giftSuggestion = functions.https.onRequest(app);