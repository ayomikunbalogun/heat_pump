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

function calculateHeatLoss(wallArea, wallU, roofArea, roofU, floorArea, floorU, indoorTemp, outdoorTemp, airChanges = 0.5) {
    const wallLoss = wallArea * wallU * (indoorTemp - outdoorTemp);
    const roofLoss = roofArea * roofU * (indoorTemp - outdoorTemp);
    const floorLoss = floorArea * floorU * (indoorTemp - outdoorTemp);

    // Calculate Volume (approximate using 2.4m ceiling height)
    // Building footprint approx = floorArea
    // If multiple floors, this might be underestimate, but reasonable approximation for volume relative to heat loss
    // Better approximation: Volume = FloorArea * 2.4 (assuming single storey or total floor area)
    const volume = floorArea * 2.4;

    // Ventilation Loss = 0.33 * Volume * ACH * (Indoor - Outdoor)
    // 0.33 is specific heat capacity of air (0.33 Wh/m3K)
    const ventilationLoss = 0.33 * volume * airChanges * (indoorTemp - outdoorTemp);

    return (wallLoss + roofLoss + floorLoss + ventilationLoss) / 1000;
}

// Validation helper function
function validateInputs(data) {
    const limits = {
        wallArea: { min: 1, max: 1000, name: "Wall Area" },
        wallU: { min: 0.1, max: 2.0, name: "Wall U-Value" },
        roofArea: { min: 1, max: 1000, name: "Roof Area" },
        roofU: { min: 0.1, max: 2.0, name: "Roof U-Value" },
        floorArea: { min: 1, max: 1000, name: "Floor Area" },
        floorU: { min: 0.1, max: 2.0, name: "Floor U-Value" },
        latitude: { min: -90, max: 90, name: "Latitude" },
        longitude: { min: -180, max: 180, name: "Longitude" },
        flowTemp: { min: 30, max: 80, name: "Flow Temperature" },
        maxOutput: { min: 1, max: 100, name: "Max Output" },
        baseTemp: { min: -50, max: 50, name: "Base Temperature" },
        indoorTemp: { min: 15, max: 30, name: "Indoor Temperature" },
        exceedanceThreshold: { min: 0, max: 8760, name: "Exceedance Threshold" },
        airChanges: { min: 0, max: 10, name: "Air Changes per Hour" },
        hotWaterUsage: { min: 0, max: 500, name: "Hot Water Usage" }
    };

    for (const [key, range] of Object.entries(limits)) {
        const value = parseFloat(data[key]);
        if (isNaN(value)) {
            return `Invalid value for ${range.name}`;
        }
        if (value < range.min || value > range.max) {
            return `${range.name} must be between ${range.min} and ${range.max}`;
        }
    }
    return null;
}


app.post('/calculate', async (req, res) => {
    try {
        const validationError = validateInputs(req.body);
        if (validationError) {
            return res.status(400).json({ error: validationError });
        }

        const {
            wallArea, wallU,
            roofArea, roofU,
            floorArea, floorU,
            latitude, longitude,
            flowTemp, maxOutput,
            baseTemp, indoorTemp,
            airChanges, hotWaterUsage
        } = req.body;

        try {
            const weatherData = await fetchPVGISData(latitude, longitude);

            if (!weatherData || !weatherData.outputs || !weatherData.outputs.tmy_hourly) {
                throw new Error('Invalid weather data received from PVGIS');
            }

            const hourlyData = weatherData.outputs.tmy_hourly;

            let totalHeatEnergy = 0;
            let totalElectricalEnergy = 0;
            let hoursExceedingCapacity = 0;
            let peakHeatLoad = 0;
            let monthlyElectricalEnergy = new Array(12).fill(0);
            let hourlyDataCollection = []; // Store all hourly data for daily charts

            // Calculate Daily Hot Water Energy
            // Energy (kWh) = Volume (L) * 4186 (J/L/K) * DeltaT (K) / 3600000 (J/kWh)
            // Assuming water heated from 10°C to 50°C (DeltaT = 40)
            const dailyHotWaterEnergy = (hotWaterUsage * 4186 * 40) / 3600000;
            const hourlyHotWaterEnergy = dailyHotWaterEnergy / 24; // Average hourly demand

            for (const hour of hourlyData) {
                const outdoorTemp = hour.T2m;
                // PVGIS API uses 'time(UTC)' field, not 'time'
                const timeStr = hour['time(UTC)'] || '';
                const monthIndex = timeStr ? parseInt(timeStr.substring(4, 6)) - 1 : 0;

                // Extract day of year and hour
                // PVGIS format: YYYYMMDD:HHMM (e.g., "20070115:0800")
                const month = timeStr ? parseInt(timeStr.substring(4, 6)) : 1;
                const day = timeStr ? parseInt(timeStr.substring(6, 8)) : 1;

                // Hour is after the colon (split and parse)
                let hourOfDay = 0;
                if (timeStr && timeStr.includes(':')) {
                    const timeParts = timeStr.split(':');
                    hourOfDay = timeParts[1] ? parseInt(timeParts[1].substring(0, 2)) : 0;
                }

                // Calculate approximate day of year
                const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
                let dayOfYear = day;
                for (let i = 0; i < month - 1; i++) {
                    dayOfYear += daysInMonth[i];
                }

                let electricalEnergyUsed = 0;
                let totalHourlyHeatLoad = 0;

                let heatLossKW = 0;

                if (outdoorTemp < baseTemp) {
                    const heatLoss = calculateHeatLoss(
                        wallArea, wallU,
                        roofArea, roofU,
                        floorArea, floorU,
                        indoorTemp, outdoorTemp,
                        airChanges
                    );

                    // Convert W to kW (Already converted in calculateHeatLoss)
                    heatLossKW = heatLoss;
                }

                totalHourlyHeatLoad = heatLossKW + hourlyHotWaterEnergy;

                if (totalHourlyHeatLoad > peakHeatLoad) {
                    peakHeatLoad = totalHourlyHeatLoad;
                }

                // Add to total energy (kW * 1 hour)
                totalHeatEnergy += totalHourlyHeatLoad;

                const cop = getCoP(flowTemp, outdoorTemp);
                // Electrical energy covers both space heating and hot water
                // using the heat pump's COP for both for simplicity
                electricalEnergyUsed = totalHourlyHeatLoad / cop;
                totalElectricalEnergy += electricalEnergyUsed;
                monthlyElectricalEnergy[monthIndex] += electricalEnergyUsed;

                if (heatLossKW > maxOutput) {
                    hoursExceedingCapacity++;
                }

                // Store hourly data point for daily charts
                hourlyDataCollection.push({
                    dayOfYear,
                    hour: hourOfDay,
                    temperature: outdoorTemp,
                    electricalEnergy: electricalEnergyUsed
                });
            }

            const averageCoP = totalElectricalEnergy > 0 ? totalHeatEnergy / totalElectricalEnergy : 0;

            // Calculate recommended size based on threshold
            // Sort all hourly heat loads (derived from hourlyDataCollection)
            // We need to re-calculate heat loads for all hours to be precise, or store them
            // Let's iterate again or store heat loads during the loop.
            // Better: Store heat loads in a separate array during the main loop.
            // But wait, we only calculate heat loss if temp < baseTemp.
            // If temp >= baseTemp, heat loss is 0.

            // Calculate recommended size based on threshold
            const allHourlyLoads = hourlyData.map(hour => {
                const outdoorTemp = hour.T2m;
                let hourlyLoad = hourlyHotWaterEnergy; // Constant base load

                if (outdoorTemp < baseTemp) {
                    const spaceHeating = calculateHeatLoss(
                        wallArea, wallU,
                        roofArea, roofU,
                        floorArea, floorU,
                        indoorTemp, outdoorTemp,
                        airChanges
                    );
                    hourlyLoad += spaceHeating; // Already in kW
                }
                return hourlyLoad;
            });

            // Sort descending: highest load first
            allHourlyLoads.sort((a, b) => b - a);

            // Get threshold from request body (default to 24 if not provided)
            const threshold = req.body.exceedanceThreshold !== undefined ? parseInt(req.body.exceedanceThreshold) : 24;

            // The recommended size is the value that leaves 'threshold' hours larger than it.
            // If threshold is 0, we need index 0 (max load).
            // If threshold is 24, we need index 24 (the 25th largest load).
            // Any size >= allHourlyLoads[threshold] will have at most 'threshold' hours exceeding it.
            // We handle bounds check implicitly (if threshold >= 8760, it returns undefined -> 0 or handled)

            const secureThreshold = Math.min(Math.max(0, threshold), allHourlyLoads.length - 1);
            const recommendedMinSize = allHourlyLoads[secureThreshold] || 0;

            res.json({
                totalHeatEnergy,
                electricalEnergy: totalElectricalEnergy,
                averageCoP,
                hoursExceedingCapacity,
                peakHeatLoad,
                monthlyElectricalEnergy,
                hourlyDataCollection,
                recommendedMinSize // Add to response
            });

        } catch (apiError) {
            console.error('PVGIS API Error:', apiError);
            if (apiError.message.includes('400') || apiError.message.includes('404')) {
                return res.status(400).json({
                    error: "Unable to find weather data for this location. Please ensure the coordinates are on land and cover a valid region."
                });
            }
            throw apiError;
        }

    } catch (error) {
        console.error('Calculation error:', error);
        res.status(500).json({
            error: error.message || 'An error occurred during calculation'
        });
    }
});

app.listen(PORT, () => {
    console.log(`Heat pump sizing server running at http://localhost:${PORT}`);
    console.log(`Open your browser to http://localhost:${PORT} to use the calculator`);
});
