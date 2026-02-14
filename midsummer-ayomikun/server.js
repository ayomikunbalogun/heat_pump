import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(__dirname));

function getCoP(flowTemp, outdoorTemp) {
    const tempDiff = flowTemp - outdoorTemp;
    
    if (flowTemp <= 35) {
        if (tempDiff <= 20) return 4.5;
        if (tempDiff <= 30) return 4.0;
        if (tempDiff <= 40) return 3.5;
        return 3.0;
    } else if (flowTemp <= 45) {
        if (tempDiff <= 20) return 4.0;
        if (tempDiff <= 30) return 3.5;
        if (tempDiff <= 40) return 3.0;
        return 2.5;
    } else if (flowTemp <= 55) {
        if (tempDiff <= 20) return 3.5;
        if (tempDiff <= 30) return 3.0;
        if (tempDiff <= 40) return 2.5;
        return 2.2;
    } else {
        if (tempDiff <= 20) return 3.0;
        if (tempDiff <= 30) return 2.5;
        if (tempDiff <= 40) return 2.2;
        return 2.0;
    }
}

async function fetchPVGISData(latitude, longitude) {
    const url = `https://re.jrc.ec.europa.eu/api/v5_2/tmy?lat=${latitude}&lon=${longitude}&outputformat=json`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`PVGIS API error: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        throw new Error(`Failed to fetch weather data: ${error.message}`);
    }
}

function calculateHeatLoss(wallArea, wallU, roofArea, roofU, floorArea, floorU, indoorTemp, outdoorTemp) {
    const wallLoss = wallArea * wallU * (indoorTemp - outdoorTemp);
    const roofLoss = roofArea * roofU * (indoorTemp - outdoorTemp);
    const floorLoss = floorArea * floorU * (indoorTemp - outdoorTemp);
    
    return (wallLoss + roofLoss + floorLoss) / 1000;
}

app.post('/calculate', async (req, res) => {
    try {
        const {
            wallArea,
            wallU,
            roofArea,
            roofU,
            floorArea,
            floorU,
            latitude,
            longitude,
            flowTemp,
            maxOutput,
            baseTemp,
            indoorTemp
        } = req.body;

        if (!wallArea || !wallU || !roofArea || !roofU || !floorArea || !floorU ||
            !latitude || !longitude || !flowTemp || !maxOutput || !baseTemp || !indoorTemp) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const pvgisData = await fetchPVGISData(latitude, longitude);
        
        if (!pvgisData.outputs || !pvgisData.outputs.tmy_hourly) {
            throw new Error('Invalid data format from PVGIS API');
        }

        const hourlyData = pvgisData.outputs.tmy_hourly;
        
        let totalHeatEnergy = 0;
        let totalElectricalEnergy = 0;
        let hoursExceedingCapacity = 0;
        let peakHeatLoad = 0;

        for (const hour of hourlyData) {
            const outdoorTemp = hour.T2m;
            
            if (outdoorTemp < baseTemp) {
                const heatLoss = calculateHeatLoss(
                    wallArea, wallU,
                    roofArea, roofU,
                    floorArea, floorU,
                    indoorTemp,
                    outdoorTemp
                );
                
                if (heatLoss > peakHeatLoad) {
                    peakHeatLoad = heatLoss;
                }
                
                totalHeatEnergy += heatLoss;
                
                const cop = getCoP(flowTemp, outdoorTemp);
                totalElectricalEnergy += heatLoss / cop;
                
                if (heatLoss > maxOutput) {
                    hoursExceedingCapacity++;
                }
            }
        }

        const averageCoP = totalHeatEnergy / totalElectricalEnergy;

        res.json({
            totalHeatEnergy,
            electricalEnergy: totalElectricalEnergy,
            averageCoP,
            hoursExceedingCapacity,
            peakHeatLoad
        });

    } catch (error) {
        console.error('Calculation error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Heat pump sizing server running at http://localhost:${PORT}`);
    console.log(`Open your browser to http://localhost:${PORT} to use the calculator`);
});
