const path = require('path');
const cors = require('cors');
const crypto = require('crypto');
const express = require('express')
const bodyParser = require('body-parser')
const handlebars = require('handlebars');
const Webtask = require('webtask-tools');
const expressTools = require('auth0-extension-express-tools');
const middlewares = require('auth0-extension-express-tools').middlewares;
const auth0 = require('auth0-oauth2-express');
const tools = require('auth0-extension-tools');
var _ = require('lodash');
var config = require('auth0-extension-tools').config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

var metadata = require('./webtask.json');
var AuthenticationClient = require('auth0').AuthenticationClient;
var accessToken;

module.exports = function (configProvider, storageProvider) {
    const utils = require('./lib/utils');
    const index = handlebars.compile(require('./views/index'));
    const partial = handlebars.compile(require('./views/partial'));

    config.setProvider(configProvider);

    const app = express();
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: false }));

    app.use(require('./middleware/develop.js'));

    app.use(function(req, res, next){

        if(accessToken){
            req.accessToken = accessToken;
            return next();
        }

        var auth0 = new AuthenticationClient({
            domain: config('AUTH0_DOMAIN').replace('https://', ''),
            clientId: config('AUTH0_CLIENT_ID'),
            clientSecret: config('AUTH0_CLIENT_SECRET')
        });

        auth0.clientCredentialsGrant({
        audience: `${config('AUTH0_DOMAIN')}/api/v2/`,
        scope: 'read:clients read:client_keys'
        }, function (err, response) {
            if (err) {
                // Handle error.
                return next(err);
            }
            accessToken = response.access_token;
            req.accessToken = accessToken;
            next();
        });
    })

    //app.use(dashboardAdmins(config('AUTH0_DOMAIN'), 'Authentication API Debugger Extension', config('AUTH0_RTA')));

    app.get('/pkce', function (req, res) {
        const verifier = utils.base64url(crypto.randomBytes(32));
        return res.json({
            verifier: verifier,
            verifier_challenge: utils.base64url(crypto.createHash('sha256').update(verifier).digest())
        })
    });

    app.get('/hash', function (req, res) {
        res.send(partial({
            hash: utils.syntaxHighlight(req.query),
            id_token: utils.jwt(req.query && req.query.id_token),
            access_token: utils.jwt(req.query && req.query.access_token)
        }));
    });

    app.post('/request', function (req, res) {
        const request = req.body.request;
        delete req.body.request;
        res.send(partial({
            request: utils.syntaxHighlight(request),
            response: utils.syntaxHighlight(req.body),
            id_token: utils.jwt(req.body && req.body.id_token),
            access_token: utils.jwt(req.body && req.body.access_token),
            refresh_token: req.body && req.body.refresh_token
        }));
    });

    app.get('/meta', cors(), function (req, res) {
        res.status(200).send(metadata);
    });


    const renderIndex = function (req, res) {
        const headers = req.headers;
        delete headers['x-wt-params'];

        const data = {
            method: req.method,
            domain: req.webtaskContext.data.AUTH0_DOMAIN.replace('https://', ''),
            baseUrl: expressTools.urlHelpers.getBaseUrl(req),
            headers: utils.syntaxHighlight(req.headers),
            body: utils.syntaxHighlight(req.body),
            query: utils.syntaxHighlight(req.query),
            authorization_code: req.query && req.query.code,
            samlResponse: utils.samlResponse(req.body && req.body.SAMLResponse),
            wsFedResult: utils.wsFedResult(req.body && req.body.wresult),
            id_token: utils.jwt(req.body && req.body.id_token),
            access_token: utils.jwt(req.body && req.body.access_token),
            refresh_token: utils.jwt(req.body && req.body.refresh_token),
            management_access_token: req.accessToken
        };

        res.send(index(data));
    };

    app.get('*', renderIndex);
    app.post('*', renderIndex);

    return app;
}
