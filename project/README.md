# Heat Pump Sizing Calculator

A web-based application for calculating annual heating requirements and heat pump performance based on building characteristics and location-specific weather data.

## Overview

This application helps size heat pumps correctly by:
- Calculating heat loss from a property based on building envelope characteristics (U-values and surface areas)
- Fetching real meteorological data from the PVGIS API for any location
- Computing total annual heat energy requirements
- Estimating electrical energy consumption based on heat pump Coefficient of Performance (CoP)
- Identifying hours where heating demand exceeds heat pump capacity

## How It Works

### Heat Loss Calculation

The application calculates heat loss using the formula:
```
Heat Loss (W) = Σ(Area × U-value × Temperature Difference)
```

For each building element (walls, roof, floor), the heat loss is calculated and summed.

### Base Temperature Concept

Buildings receive incidental heating from:
- Occupants
- Appliances
- Solar gain

The **base temperature** is the outdoor temperature below which active heating is required. For example, if a house is heated to 20°C with a base temperature of 14°C, heating only activates when outdoor temperature drops below 14°C.

### Coefficient of Performance (CoP)

The CoP varies based on:
- Heat pump flow temperature
- Temperature difference between flow and outdoor temperatures

The application uses a lookup table to estimate CoP values, which typically range from 2.0 to 4.5.

### PVGIS API

The application uses the European Commission's Photovoltaic Geographical Information System (PVGIS) API to obtain:
- Typical Meteorological Year (TMY) data
- Hourly outdoor temperatures for a full year
- Location-specific climate data

## Installation

### Prerequisites

- Node.js (version 14 or higher)
- npm (comes with Node.js)

### Setup

1. Navigate to the project directory:
```bash
cd grad-exercise-heatpumps-test
```

2. Install dependencies:
```bash
npm install
```

## Running the Application

1. Start the Node.js server:
```bash
npm start
```

2. Open your web browser and navigate to:
```
http://localhost:3000
```

3. The server will display:
```
Heat pump sizing server running at http://localhost:3000
Open your browser to http://localhost:3000 to use the calculator
```

## Using the Calculator

### Input Parameters

Fill in the following information:

**Building Envelope - Walls:**
- Surface Area (m²): Total wall area
- U-Value (W/m²K): Thermal transmittance of walls (typical: 0.18-0.35)

**Building Envelope - Roof:**
- Surface Area (m²): Total roof area
- U-Value (W/m²K): Thermal transmittance of roof (typical: 0.11-0.25)

**Building Envelope - Floor:**
- Surface Area (m²): Total floor area
- U-Value (W/m²K): Thermal transmittance of floor (typical: 0.13-0.25)

**Location:**
- Latitude: Geographic latitude (e.g., 51.5074 for London)
- Longitude: Geographic longitude (e.g., -0.1278 for London)

**Heat Pump Specifications:**
- Flow Temperature (°C): Heat pump flow temperature (typical: 35-55°C)
- Maximum Heat Output (kW): Rated heat pump capacity

**Property Settings:**
- Base Temperature (°C): Temperature below which heating is needed (typical: 12-16°C)
- Indoor Temperature (°C): Desired indoor temperature (typical: 20-21°C)

### Results

After submitting the form, the application displays:

1. **Total Annual Heat Energy Required (kWh)**: Total heat energy needed to maintain indoor temperature
2. **Electrical Energy Used by Heat Pump (kWh)**: Actual electricity consumption
3. **Average Coefficient of Performance (CoP)**: Overall efficiency of the heat pump
4. **Hours Exceeding Heat Pump Capacity**: Number of hours where demand exceeds capacity
5. **Peak Heat Load (kW)**: Maximum instantaneous heating requirement

## Technical Details

### Backend (server.js)

- **Framework**: Express.js
- **API Integration**: Fetches data from PVGIS TMY API
- **Calculations**: 
  - Heat loss for each hour based on outdoor temperature
  - CoP estimation based on flow temperature and outdoor conditions
  - Annual energy totals and statistics

### Frontend (index.html)

- **Design**: Modern, responsive UI with gradient styling
- **Form Validation**: Client-side validation for all inputs
- **AJAX**: Asynchronous communication with backend
- **User Feedback**: Loading states, error handling, and results display

### CoP Estimation

The application uses a simplified CoP lookup table based on:
- Flow temperature ranges: ≤35°C, ≤45°C, ≤55°C, >55°C
- Temperature differences: ≤20K, ≤30K, ≤40K, >40K

Higher CoP values (better efficiency) are achieved with:
- Lower flow temperatures
- Smaller temperature differences

## Example Use Case

**Scenario**: A well-insulated house in London

**Inputs**:
- Walls: 120 m², U-value 0.20 W/m²K
- Roof: 80 m², U-value 0.15 W/m²K
- Floor: 80 m², U-value 0.18 W/m²K
- Location: 51.5074, -0.1278
- Flow Temperature: 45°C
- Max Output: 8 kW
- Base Temperature: 14°C
- Indoor Temperature: 20°C

**Expected Results**:
- Annual heat energy: ~8,000-12,000 kWh
- Electrical energy: ~2,500-4,000 kWh
- Average CoP: ~3.0-3.5
- Hours exceeding capacity: Should be minimal for properly sized system

## Troubleshooting

**Server won't start:**
- Ensure Node.js is installed: `node --version`
- Check if port 3000 is available
- Verify all dependencies are installed: `npm install`

**API errors:**
- Check internet connection
- Verify latitude/longitude are within valid ranges
- PVGIS API may have rate limits or temporary outages

**Unexpected results:**
- Verify U-values are realistic (typically 0.1-0.5 W/m²K)
- Check that base temperature < indoor temperature
- Ensure surface areas are in m² (not ft²)

## Files Structure

```
grad-exercise-heatpumps-test/
├── server.js          # Node.js backend server
├── index.html         # Frontend interface
├── package.json       # Node.js dependencies
└── README.md          # This file
```

## License

MIT
