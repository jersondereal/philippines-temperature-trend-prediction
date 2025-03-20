"use client";

import { useToast } from "@/components/ui/use-toast";
import { createClient } from "@/utils/supabase/client";
import { mockTemperatureData } from "@/utils/temp-data";
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import regression from "regression";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Temperature data structure from Supabase database
type TemperatureData = {
  year: string;
  annual_mean: number;
  five_year_smooth: number;
};

// Update model type definition
type ModelType = "polynomial" | "moving-average" | "linear";

// Define consistent colors for both themes
const chartColors = {
  polynomial: {
    border: "hsl(220, 70%, 50%)",
    background: "hsla(220, 70%, 50%, 0.3)",
  },
  linear: {
    border: "hsl(160, 70%, 50%)",
    background: "hsla(160, 70%, 50%, 0.3)",
  },
  movingAverage: {
    border: "hsl(340, 80%, 60%)",
    background: "hsla(340, 80%, 60%, 0.3)",
  },
  prediction: {
    border: "hsl(60, 80%, 50%)",
    background: "hsla(60, 80%, 50%, 0.3)",
  },
};

/**
 * Converts simulation data to CSV format
 */
function generateCSV(
  data: TemperatureData[],
  result: any,
  predictionLine: { years: string[]; temps: number[] }
) {
  // Headers
  let csv = "Year,Annual Mean,5-Year Smooth\n";

  // Historical data
  data.forEach((row) => {
    csv += `${row.year},${row.annual_mean},${row.five_year_smooth}\n`;
  });

  // Prediction data
  if (result && predictionLine.years.length > 0) {
    csv += "\nPrediction Results\n";
    csv += "Year,Predicted Temperature\n";
    predictionLine.years.forEach((year, index) => {
      csv += `${year},${predictionLine.temps[index]}\n`;
    });

    csv += "\nSimulation Details\n";
    result.details.forEach((detail: string) => {
      csv += `${detail}\n`;
    });
  }

  return csv;
}

export default function SimulationInterface() {
  console.log("SimulationInterface rendering");

  const { toast } = useToast();
  const { theme, systemTheme } = useTheme();
  // Check if dark mode is active by considering both explicit dark theme and system theme
  const isDarkTheme =
    theme === "dark" || (theme === "system" && systemTheme === "dark");
  // State management for simulation data and UI
  const [data, setData] = useState<TemperatureData[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelType>("polynomial");
  const [yearToPredict, setYearToPredict] = useState<string>("2030");
  const [result, setResult] = useState<{
    prediction: number;
    details: string[];
    error?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [predictionLine, setPredictionLine] = useState<{
    years: string[];
    temps: number[];
  }>({ years: [], temps: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userInitiated, setUserInitiated] = useState(false);

  // Initialize Supabase client for data fetching
  const supabase = createClient();

  // Fetch historical temperature data on component mount
  useEffect(() => {
    console.log("Fetching data");
    fetchData();
  }, []);

  // Automatically run simulation when model changes and there are existing results
  useEffect(() => {
    if (data.length > 0 && result !== null && userInitiated) {
      handleSimulation();
    }
  }, [selectedModel]);

  // Add this near the start of the component, right after the state definitions
  useEffect(() => {
    // Only initialize prediction if user has explicitly requested it
    if (data.length > 0 && !result && userInitiated) {
      handleSimulation();
    }
  }, [data]);

  // Verify regression has the linear method
  useEffect(() => {
    // Log regression methods for debugging
    console.log("Regression methods:", Object.keys(regression));
  }, []);

  /**
   * Fetches historical temperature data from Supabase
   * Handles loading states and error scenarios
   */
  async function fetchData() {
    setIsLoading(true);
    setError(null);

    // Immediately set mock data initially to ensure we have something to display
    setData(mockTemperatureData);
    console.log("Set initial mock data, length:", mockTemperatureData.length);

    try {
      // Try to fetch from Supabase
      const { data: tempData, error: fetchError } = await supabase
        .from("philippines_temperature_trends")
        .select("*")
        .order("year", { ascending: true });

      if (fetchError) {
        console.error("Error fetching data:", fetchError);
        toast({
          title: "Using sample data",
          description:
            "Connected to database failed. Using sample data instead.",
          variant: "default",
        });
      } else if (tempData && tempData.length > 0) {
        console.log("Got Supabase data, length:", tempData.length);
        setData(tempData as TemperatureData[]);
      } else {
        console.log("No data from Supabase, continuing with mock data");
      }
    } catch (error) {
      console.error("Error connecting to Supabase:", error);
      toast({
        title: "Using sample data",
        description: "Connected to database failed. Using sample data instead.",
        variant: "default",
      });
    }

    setIsLoading(false);
  }

  /**
   * Calculates temperature prediction using polynomial regression
   * @param targetYear - Year to predict temperature for
   * @returns Object containing prediction, equation, and R² value
   */
  function calculatePolynomialRegression(targetYear: string = yearToPredict) {
    if (data.length === 0) return { prediction: 0, equation: "", r2: 0 };

    // Use more recent data (last 30 years) to capture current trends better
    const recentData = data.slice(-30);

    // Normalize years to prevent numerical instability
    const baseYear = parseInt(recentData[0].year);
    const points = recentData.map(
      (d) =>
        [
          Number(d.year) - baseYear, // Normalize years
          d.five_year_smooth,
        ] as [number, number]
    );

    // Calculate regression with quadratic polynomial (order: 2) for more conservative predictions
    const result = regression.polynomial(points, { order: 2, precision: 10 });

    // For prediction, normalize the target year the same way
    const normalizedYear = parseInt(targetYear) - baseYear;

    // Apply stronger dampening factor for long-term predictions to prevent unrealistic growth
    const currentYear = new Date().getFullYear();
    const yearsIntoFuture = parseInt(targetYear) - currentYear;

    // More aggressive dampening to flatten the curve for distant predictions
    const dampeningFactor = Math.max(
      0.2,
      1 - Math.pow(yearsIntoFuture / 50, 0.8)
    );

    const rawPrediction = result.predict(normalizedYear)[1];

    // Calculate how much the raw prediction deviates from the last known value
    const lastKnownTemp = recentData[recentData.length - 1].five_year_smooth;
    const predictedChange = rawPrediction - lastKnownTemp;

    // Apply stronger dampening for larger changes
    const adjustmentFactor =
      predictedChange > 0
        ? Math.max(0.3, 1 - predictedChange / 10) // For positive changes (warming)
        : Math.min(1.7, 1 - predictedChange / 10); // For negative changes (cooling)

    // Apply both dampening factors
    const dampedChange = predictedChange * dampeningFactor * adjustmentFactor;
    const prediction = lastKnownTemp + dampedChange;

    // Get coefficients for a more readable equation
    const [a, b, c] = result.equation;
    const equation = `y = ${a.toExponential(6)}x² + ${b.toFixed(6)}x + ${c.toFixed(4)}`;

    // Calculate base R² (model fit to historical data)
    const n = points.length;
    const p = 2; // number of predictors (x and x²)
    const baseR2 = 1 - ((1 - result.r2) * (n - 1)) / (n - p - 1);

    // Calculate confidence decay based on prediction distance
    const maxConfidentYears = 15; // Extended from 10 to 15 years for full confidence
    const maxPredictionYears = 76; // Years until 2100

    let confidenceMultiplier = 1;
    if (yearsIntoFuture > maxConfidentYears) {
      // Slower decay from 100% to 25%
      const decay = Math.pow(
        (yearsIntoFuture - maxConfidentYears) /
          (maxPredictionYears - maxConfidentYears),
        0.7
      );
      confidenceMultiplier = Math.max(0.25, 1 - decay * 0.75);
    }

    // Apply distance-based confidence reduction
    const adjustedR2 = baseR2 * confidenceMultiplier;

    return {
      prediction,
      equation,
      r2: adjustedR2,
    };
  }

  /**
   * Calculates temperature prediction using 5-year moving average
   * @param targetYear - Year to predict temperature for
   * @returns Object containing prediction and descriptive statistics
   */
  function calculateMovingAverage(targetYear: string = yearToPredict) {
    if (data.length === 0) return { prediction: 0, description: "", r2: 0 };

    // Get the last 5 years of data
    const recentData = data.slice(-5);
    const avgTemp =
      recentData.reduce((sum, d) => sum + d.five_year_smooth, 0) /
      recentData.length;

    // Calculate the average yearly rate of change over the last 5 years
    const yearlyChange =
      (recentData[recentData.length - 1].five_year_smooth -
        recentData[0].five_year_smooth) /
      4; // 4 intervals in 5 years

    // Calculate years from last data point
    const lastYear = parseInt(data[data.length - 1].year);
    const yearsAhead = parseInt(targetYear) - lastYear;

    // Project temperature using the yearly rate of change
    const prediction = avgTemp + yearlyChange * yearsAhead;

    // Calculate confidence based on how well the linear trend fits
    const startTemp = recentData[0].five_year_smooth;
    const predictedValues = recentData.map(
      (_, i) => startTemp + yearlyChange * i
    );
    const actualValues = recentData.map((d) => d.five_year_smooth);

    const meanActual =
      actualValues.reduce((a, b) => a + b) / actualValues.length;
    const ssTotal = actualValues.reduce(
      (sum, val) => sum + Math.pow(val - meanActual, 2),
      0
    );
    const ssResidual = actualValues.reduce(
      (sum, val, i) => sum + Math.pow(val - predictedValues[i], 2),
      0
    );

    // Ensure R² is between 0 and 1
    const r2 = Math.max(0, Math.min(1, 1 - ssResidual / ssTotal));

    return {
      prediction,
      description: `Rate of change: ${yearlyChange > 0 ? "+" : ""}${(yearlyChange * 100).toFixed(4)}°C per year`,
      r2,
    };
  }

  /**
   * Calculates temperature prediction using simple linear regression
   * @param targetYear - Year to predict temperature for
   * @returns Object containing prediction, equation, and R² value
   */
  function calculateLinearRegression(targetYear: string = yearToPredict) {
    if (data.length === 0) return { prediction: 0, equation: "", r2: 0 };

    // Normalize years by using the first year in the dataset as base year
    const baseYear = parseInt(data[0].year);

    // Create normalized points where x is years since baseYear
    const points = data.map(
      (d) => [Number(d.year) - baseYear, d.five_year_smooth] as [number, number]
    );

    // Calculate linear regression on normalized data
    const result = regression.linear(points, { precision: 10 });

    // For prediction, normalize the target year the same way
    const normalizedYear = parseInt(targetYear) - baseYear;
    const prediction = result.predict(normalizedYear)[1];

    // Get coefficients for the equation
    const [slope, intercept] = result.equation;

    // The intercept now represents the estimated temperature at the baseYear
    const equationYear = baseYear;
    const equation = `y = ${slope.toFixed(6)}x + ${intercept.toFixed(4)}`;

    // Provide a more intuitive equation for users
    const simplifiedEquation = `Temperature in ${targetYear} = ${intercept.toFixed(2)}°C + ${slope > 0 ? "+" : ""}${(slope * (parseInt(targetYear) - baseYear)).toFixed(2)}°C`;

    // Apply confidence adjustment based on prediction distance
    const currentYear = new Date().getFullYear();
    const yearsIntoFuture = parseInt(targetYear) - currentYear;
    const maxConfidentYears = 15;
    const maxPredictionYears = 76;

    let confidenceMultiplier = 1;
    if (yearsIntoFuture > maxConfidentYears) {
      const decay = Math.pow(
        (yearsIntoFuture - maxConfidentYears) /
          (maxPredictionYears - maxConfidentYears),
        0.7
      );
      confidenceMultiplier = Math.max(0.25, 1 - decay * 0.75);
    }

    // Apply distance-based confidence reduction
    const adjustedR2 = result.r2 * confidenceMultiplier;

    return {
      prediction,
      equation,
      simplifiedEquation,
      baseYear,
      slope,
      intercept,
      r2: adjustedR2,
    };
  }

  /**
   * Generates points for prediction trend line visualization
   * @param prediction - Final predicted temperature
   * @param model - Selected prediction model type
   * @returns Object containing arrays of years and temperatures for plotting
   */
  function generatePredictionLine(
    predictionTemp: number,
    modelType: ModelType
  ) {
    // Use length check to avoid errors
    if (data.length === 0) {
      return { years: [], temps: [] };
    }

    const lastDataYear = parseInt(data[data.length - 1].year);
    const predictionYear = parseInt(yearToPredict);
    const years: string[] = [];
    const temps: number[] = [];

    // Start from the last data point
    years.push(lastDataYear.toString());
    temps.push(data[data.length - 1].five_year_smooth);

    // Generate prediction line points
    const numPoints = 5; // Use 5 points for a smoother line
    const yearStep = Math.ceil((predictionYear - lastDataYear) / numPoints);

    // Ensure we have at least one step
    if (yearStep <= 0 || predictionYear <= lastDataYear) {
      // Just add the prediction point
      years.push(predictionYear.toString());
      temps.push(predictionTemp);
      return { years, temps };
    }

    for (
      let year = lastDataYear + yearStep;
      year <= predictionYear;
      year += yearStep
    ) {
      const currentYear = year.toString();
      years.push(currentYear);

      // Calculate intermediate predictions
      let temp;
      if (modelType === "polynomial") {
        const { prediction: intermediateTemp } =
          calculatePolynomialRegression(currentYear);
        temp = intermediateTemp;
      } else if (modelType === "linear") {
        const { prediction: intermediateTemp } =
          calculateLinearRegression(currentYear);
        temp = intermediateTemp;
      } else {
        const { prediction: intermediateTemp } =
          calculateMovingAverage(currentYear);
        temp = intermediateTemp;
      }

      // Ensure we have a valid number
      temps.push(isNaN(temp) ? predictionTemp : temp);
    }

    // Ensure the final prediction point is included
    if (years[years.length - 1] !== predictionYear.toString()) {
      years.push(predictionYear.toString());
      temps.push(predictionTemp);
    }

    console.log("Generated prediction line:", { years, temps });
    return { years, temps };
  }

  /**
   * Handles the simulation process:
   * 1. Validates input year
   * 2. Calculates prediction using selected model
   * 3. Validates prediction against historical ranges
   * 4. Generates visualization data
   */
  function handleSimulation() {
    // Set user initiated to true
    setUserInitiated(true);

    // Add year validation
    const inputYear = parseInt(yearToPredict);
    if (inputYear < 2024) {
      setResult({
        prediction: 0,
        details: ["Invalid year selected"],
        error: "Please select a year from 2024 onwards for predictions.",
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let prediction: number;
      let details: string[] = [];

      if (selectedModel === "polynomial") {
        const {
          prediction: polyPrediction,
          r2,
          equation,
        } = calculatePolynomialRegression();
        prediction = polyPrediction;
        details = [
          `Year: ${yearToPredict}`,
          `Predicted Temperature: ${polyPrediction.toFixed(1)}°C`,
          `Model: Polynomial Regression`,
          `Equation: ${equation}`,
          `Model Confidence: ${(r2 * 100).toFixed(0)}%`,
        ];
      } else if (selectedModel === "linear") {
        const {
          prediction: linearPrediction,
          r2,
          equation,
          simplifiedEquation,
          baseYear,
          intercept = 0, // Provide default value to avoid undefined error
        } = calculateLinearRegression();
        prediction = linearPrediction;
        details = [
          `Year: ${yearToPredict}`,
          `Predicted Temperature: ${linearPrediction.toFixed(1)}°C`,
          `Model: Linear Regression`,
          `Base Year: ${baseYear} (Temperature: ${intercept.toFixed(2)}°C)`,
          `Technical Equation: ${equation}`,
          // `Simplified: ${simplifiedEquation}`,
          `Model Confidence: ${(r2 * 100).toFixed(0)}%`,
        ];
      } else {
        const { prediction: mavgPrediction, r2 } = calculateMovingAverage();
        prediction = mavgPrediction;
        details = [
          `Year: ${yearToPredict}`,
          `Predicted Temperature: ${mavgPrediction.toFixed(1)}°C`,
          `Model: 5-Year Moving Average`,
          `Model Confidence: ${(r2 * 100).toFixed(0)}%`,
        ];
      }

      // Validate prediction
      const maxTemp = Math.max(...data.map((d) => d.annual_mean));
      const minTemp = Math.min(...data.map((d) => d.annual_mean));
      const baseMargin = 1.5;

      // Dynamic margin that increases with prediction distance
      const currentYear = new Date().getFullYear();
      const yearsIntoFuture = parseInt(yearToPredict) - currentYear;
      const marginIncrease = Math.min(3, yearsIntoFuture / 20); // Increases by up to 3°C based on prediction distance
      const margin = baseMargin + marginIncrease;

      const allowedMin = minTemp - margin;
      const allowedMax = maxTemp + margin;

      if (prediction < allowedMin || prediction > allowedMax) {
        setResult({
          prediction: 0,
          details: ["Out of realistic range"],
          error: "Prediction falls outside realistic range.",
        });
        setLoading(false);
        return;
      }

      // Generate prediction line data
      const predLine = generatePredictionLine(prediction, selectedModel);
      console.log("Setting prediction line:", predLine);
      setPredictionLine(predLine);

      setResult({
        prediction,
        details,
      });
    } catch (error) {
      console.error("Simulation error:", error);
      setResult({
        prediction: 0,
        details: ["❌ Something went wrong. Please try again."],
        error: "Calculation error occurred",
      });
    } finally {
      setLoading(false);
    }
  }

  /**
   * Calculates appropriate y-axis range for chart based on prediction
   * Ensures visualization remains clear and meaningful
   */
  function calculateYAxisRange(prediction: number | undefined) {
    const baseMin = 24;
    const baseMax = 28;

    if (!prediction) return { min: baseMin, max: baseMax };

    if (prediction > 29) {
      return { min: baseMin, max: 30 };
    } else if (prediction > 28) {
      return { min: baseMin, max: 29 };
    }

    return { min: baseMin, max: baseMax };
  }

  const yAxisRange = calculateYAxisRange(result?.prediction);

  // Chart data structure for visualization
  const chartData = {
    labels: [
      ...data.filter((_, index) => index % 10 === 0).map((d) => d.year),
      ...(userInitiated ? predictionLine.years.slice(1) : []),
    ],
    datasets: [
      // Show Annual Mean Temperature for polynomial regression
      ...(selectedModel === "polynomial"
        ? [
            {
              label: "Annual Mean Temperature",
              data:
                data.length > 0
                  ? data
                      .filter((_, index) => index % 10 === 0)
                      .map((d) => d.annual_mean)
                  : [],
              borderColor: chartColors.polynomial.border,
              backgroundColor: chartColors.polynomial.background,
              tension: 0.1,
              pointRadius: 4,
            },
          ]
        : []),

      // Show 5-Year Smooth for linear regression
      ...(selectedModel === "linear"
        ? [
            {
              label: "Historical Data (5-Year Smooth)",
              data:
                data.length > 0
                  ? data
                      .filter((_, index) => index % 10 === 0)
                      .map((d) => d.five_year_smooth)
                  : [],
              borderColor: chartColors.linear.border,
              backgroundColor: chartColors.linear.background,
              tension: 0.1,
              pointRadius: 4,
            },
          ]
        : []),

      // Show 5-Year Smooth for moving average
      ...(selectedModel === "moving-average"
        ? [
            {
              label: "5-Year Smooth",
              data:
                data.length > 0
                  ? data
                      .filter((_, index) => index % 10 === 0)
                      .map((d) => d.five_year_smooth)
                  : [],
              borderColor: chartColors.movingAverage.border,
              backgroundColor: chartColors.movingAverage.background,
              tension: 0.1,
              pointRadius: 4,
            },
          ]
        : []),

      // Only show prediction trend after user has initiated a simulation
      ...(userInitiated
        ? [
            {
              label: "Prediction Trend",
              data:
                data.length > 0 && predictionLine.years.length > 0
                  ? [
                      // Add nulls up to the second-to-last historical data point
                      ...Array(
                        Math.max(
                          0,
                          data.filter((_, index) => index % 10 === 0).length - 1
                        )
                      ).fill(null),
                      // Last historical data point
                      data.length > 0
                        ? data[data.length - 1].five_year_smooth
                        : null,
                      // Future prediction points
                      ...predictionLine.temps.slice(1),
                    ]
                  : [],
              borderColor: isDarkTheme
                ? chartColors.prediction.border // Keep yellow in dark theme
                : "hsl(25, 90%, 55%)", // Orange for light theme
              backgroundColor: isDarkTheme
                ? chartColors.prediction.background // Keep yellow in dark theme
                : "hsla(25, 90%, 55%, 0.3)", // Orange for light theme
              borderDash: [5, 5],
              tension: 0.1,
              pointRadius: 4,
            },
          ]
        : []),
    ],
  };

  // Chart display options and styling
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          color: isDarkTheme ? "rgba(255, 255, 255, 0.8)" : undefined,
        },
      },
      title: {
        display: true,
        text: "Philippines Temperature Trends (1901-2022)",
        font: {
          size: 16,
        },
        color: isDarkTheme ? "rgba(255, 255, 255, 0.9)" : undefined,
      },
    },
    scales: {
      y: {
        min: yAxisRange.min,
        max: yAxisRange.max,
        title: {
          display: true,
          text: "Temperature (°C)",
          font: {
            size: 14,
          },
          color: isDarkTheme ? "rgba(255, 255, 255, 0.9)" : undefined,
        },
        ticks: {
          stepSize: 0.5,
          font: {
            size: 14,
          },
          color: isDarkTheme ? "rgba(255, 255, 255, 0.7)" : undefined,
          callback: function (tickValue: number | string) {
            return typeof tickValue === "number" ? `${tickValue}°C` : tickValue;
          },
        },
        grid: {
          color: isDarkTheme ? "rgba(255, 255, 255, 0.1)" : undefined,
        },
      },
      x: {
        title: {
          display: true,
          text: "Year",
          font: {
            size: 14,
          },
          color: isDarkTheme ? "rgba(255, 255, 255, 0.9)" : undefined,
        },
        ticks: {
          font: {
            size: 14,
          },
          color: isDarkTheme ? "rgba(255, 255, 255, 0.7)" : undefined,
        },
        grid: {
          color: isDarkTheme ? "rgba(255, 255, 255, 0.1)" : undefined,
        },
      },
    },
  };

  /**
   * Handles the export of simulation data
   */
  function handleExport(
    data: TemperatureData[],
    result: any,
    predictionLine: { years: string[]; temps: number[] }
  ) {
    const csv = generateCSV(data, result, predictionLine);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", "temperature_simulation_results.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Show success toast
    toast({
      title: "Export Successful",
      description: "Your simulation results have been downloaded.",
      duration: 3000,
    });
  }

  return (
    <div className="w-full space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="mb-6">
            <label
              htmlFor="modelSelect"
              className="block text-sm font-medium mb-2"
            >
              Prediction Model
            </label>
            <select
              id="modelSelect"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as ModelType)}
              className="w-full p-2.5 bg-background text-foreground border border-input rounded-md"
            >
              <option value="polynomial">Polynomial Regression</option>
              <option value="linear">Linear Regression</option>
              <option value="moving-average">5-Year Moving Average</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Year to Predict
            </label>
            <input
              type="number"
              className="w-full p-2 border rounded-md bg-background"
              value={yearToPredict}
              onChange={(e) => setYearToPredict(e.target.value)}
              min="2024"
              max="2100"
            />
          </div>

          <button
            className="w-full bg-foreground text-background py-2 px-4 rounded-md hover:bg-foreground/90 transition disabled:opacity-50"
            onClick={handleSimulation}
            disabled={loading}
          >
            {loading ? "Calculating..." : "Run Simulation"}
          </button>

          {result && (
            <div className="mt-4 space-y-4">
              {result.error && (
                <div className="p-4 bg-red-100 border border-red-300 rounded-md text-red-700">
                  {result.error}
                </div>
              )}
              <div className="bg-muted rounded-md overflow-hidden">
                <div className="p-4 bg-muted/50 border-b">
                  <h3 className="text-lg font-medium">Simulation Results</h3>
                </div>
                <div className="p-4 space-y-2">
                  {result.details.map((detail, index) => (
                    <p key={index} className="text-sm">
                      {detail}
                    </p>
                  ))}
                </div>
              </div>

              <button
                className="w-full bg-primary text-primary-foreground py-2 px-4 rounded-md hover:bg-primary/90 transition"
                onClick={() => handleExport(data, result, predictionLine)}
              >
                Export Results
              </button>
            </div>
          )}
        </div>

        <div
          className="lg:col-span-2 bg-background p-4 rounded-lg border"
          style={{ height: "500px" }}
        >
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center text-destructive">
              <p>{error}</p>
            </div>
          ) : (
            <Line data={chartData} options={chartOptions} />
          )}
        </div>
      </div>
    </div>
  );
}
