REST API

Home Assistant provides a RESTful API on the same port as the web frontend (default port is port 8123).

If you are not using the frontend in your setup then you need to add the api integration to your configuration.yaml file.

    http://IP_ADDRESS:8123/ is an interface to control Home Assistant.
    http://IP_ADDRESS:8123/api/ is a RESTful API.

The API accepts and returns only JSON encoded objects.

All API calls have to be accompanied by the header Authorization: Bearer TOKEN, where TOKEN is replaced by your unique access token. You obtain a token ("Long-Lived Access Token") by logging into the frontend using a web browser, and going to your profile http://IP_ADDRESS:8123/profile. Be careful to copy the whole key.

There are multiple ways to consume the Home Assistant Rest API. One is with curl:

curl \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  http://IP_ADDRESS:8123/ENDPOINT

Another option is to use Python and the Requests module.

from requests import get

url = "http://localhost:8123/ENDPOINT"
headers = {
    "Authorization": "Bearer TOKEN",
    "content-type": "application/json",
}

response = get(url, headers=headers)
print(response.text)

Another option is to use the RESTful Command integration in a Home Assistant automation or script.

turn_light_on:
  url: http://localhost:8123/api/states/light.study_light
  method: POST
  headers:
    authorization: 'Bearer TOKEN'
    content-type: 'application/json'
  payload: '{"state":"on"}'

Successful calls will return status code 200 or 201. Other status codes that can return are:

    400 (Bad Request)
    401 (Unauthorized)
    404 (Not Found)
    405 (Method Not Allowed)


get /api/states/<entity_id>

Returns a state object for specified entity_id. Returns 404 if not found.

{
   "attributes":{
      "azimuth":336.34,
      "elevation":-17.67,
      "friendly_name":"Sun",
      "next_rising":"2016-05-31T03:39:14+00:00",
      "next_setting":"2016-05-31T19:16:42+00:00"
   },
   "entity_id":"sun.sun",
   "last_changed":"2016-05-30T21:43:29.204838+00:00",
   "last_updated":"2016-05-30T21:50:30.529465+00:00",
   "state":"below_horizon"
}

Sample curl command:

curl \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:8123/api/states/sensor.kitchen_temperature

