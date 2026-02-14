
function calculateHeatLoss(wallArea, wallU, roofArea, roofU, floorArea, floorU, indoorTemp, outdoorTemp) {
    const wallLoss = wallArea * wallU * (indoorTemp - outdoorTemp);
    const roofLoss = roofArea * roofU * (indoorTemp - outdoorTemp);
    const floorLoss = floorArea * floorU * (indoorTemp - outdoorTemp);

    return (wallLoss + roofLoss + floorLoss) / 1000;
}

// User Inputs
const inputs = {
    wallArea: 120, wallU: 0.20,
    roofArea: 80, roofU: 0.15,
    floorArea: 80, roofU: 0.18, // Note: user said floor approx 80. Floor U 0.18.
    floorU: 0.18,
    indoorTemp: 20
};

// Mock weather data: 24 hours at different temps
// 12 hours at 5°C, 12 hours at 10°C
const hours = 8760;
const avgTemp = 10; // Simple average
let totalHeatkWh = 0;

for (let i = 0; i < hours; i++) {
    // Simple variation
    const outdoor = avgTemp + Math.sin(i / 12) * 5; // Swing between 5 and 15
    if (outdoor < 14) { // Base temp 14
        const lossKW = calculateHeatLoss(
            inputs.wallArea, inputs.wallU,
            inputs.roofArea, inputs.roofU, // Note: Using roofU correctly
            inputs.floorArea, inputs.floorU,
            inputs.indoorTemp, outdoor
        );
        totalHeatkWh += lossKW;
    }
}

console.log("Total Annual Heat Energy (Fabric Only): " + totalHeatkWh.toFixed(2) + " kWh");
console.log("If 4 kWh -> Bug exists.");
console.log("If ~3000 kWh -> Math is correct, missing Ventilation/DHW.");
