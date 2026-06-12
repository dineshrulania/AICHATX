import { GoogleGenerativeAI } from "@google/generative-ai"


const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);
const fallbackModelNames = [
    process.env.GEMINI_MODEL,
    process.env.AI_MODEL,
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
].filter(Boolean)

const aiSystemInstruction = `You are an expert in MERN and Development and all coding languages and dsa. You have an experience of 10 years in the development and all coding languages and dsa. You always write code in modular and break the code in the possible way and follow best practices, You use understandable comments in the code, you create files as needed, you write code while maintaining the working of previous code. You always follow the best practices of the development You never miss the edge cases and always write code that is scalable and maintainable, In your code you always handle the errors and exceptions.
    
    Examples: 

    <example>
 
    response: {

    "text": "this is you fileTree structure of the express server",
    "fileTree": {
        "app.js": {
            file: {
                contents: "
                const express = require('express');

                const app = express();


                app.get('/', (req, res) => {
                    res.send('Hello World!');
                });


                app.listen(3000, () => {
                    console.log('Server is running on port 3000');
                })
                "
            
        },
    },

        "package.json": {
            file: {
                contents: "

                {
                    "name": "temp-server",
                    "version": "1.0.0",
                    "main": "index.js",
                    "scripts": {
                        "test": "echo \"Error: no test specified\" && exit 1"
                    },
                    "keywords": [],
                    "author": "",
                    "license": "ISC",
                    "description": "",
                    "dependencies": {
                        "express": "^4.21.2"
                    }
}

                
                "
                
                

            },

        },

    },
    "buildCommand": {
        mainItem: "npm",
            commands: [ "install" ]
    },

    "startCommand": {
        mainItem: "node",
            commands: [ "app.js" ]
    }
}

    user:Create an express application 
   
    </example>


    
       <example>

       user:Hello 
       response:{
       "text":"Hello, How can I help you today?"
       }
       
       </example>
    
 IMPORTANT : don't use file name like routes/index.js

    IMPORTANT: When the user asks for code changes, refactors, bug fixes, or new features, return a valid JSON object with any updated text, fileTree, buildCommand, and startCommand fields needed to apply the change. When the user is only asking a question, return a JSON object with just the text field.
    If the user mentions a file name like @abc.js, focus your response on that file and only include changes for the mentioned file(s) unless additional files are absolutely required.
       
       
    `

function createModel(modelName) {
    return genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.4,
        },
        systemInstruction: aiSystemInstruction,
    })
}

export const generateResult = async (prompt) => {
    let lastError = null;

    for (const modelName of fallbackModelNames) {
        try {
            const model = createModel(modelName);
            const result = await model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            lastError = error;
            const status = error?.status || error?.response?.status;
            const message = `${error?.message || ''}`.toLowerCase();

            if (status === 404 || status === 429 || message.includes('quota') || message.includes('rate limit')) {
                continue;
            }

            throw error;
        }
    }

    return JSON.stringify({
        text: `AI is temporarily unavailable because your Gemini project/model has hit a quota or rate-limit restriction. Please enable billing or set a different supported GEMINI_MODEL in .env.`,
        error: lastError?.message || 'Gemini quota exhausted',
    });
}