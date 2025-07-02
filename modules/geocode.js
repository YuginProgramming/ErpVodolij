import axios from "axios";
import { dataBot } from "../values.js";

const geocode = async (targetCoordinate) => {
    const addressResponse = await axios.get('https://maps.googleapis.com/maps/api/geocode/json?',
        { 
            params: 
                {
                    latlng: targetCoordinate.lat + ',' + targetCoordinate.lon,
                    key: dataBot.gapiKey,
                }
            }
    );

    const data = addressResponse.data;


    if (data.status === 'OK' ) {

        const address = data.results[0];

        const addressFormatted = `${address.address_components[1].short_name}, ${address.address_components[0].short_name}`;

        return addressFormatted;

    } else {

        console.error("Error or no routes found:", data.status);

    }
}

export default geocode;
