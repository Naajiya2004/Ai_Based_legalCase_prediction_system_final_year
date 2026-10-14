export async function predictCase(caseDescription) {
  const response = await fetch("http://127.0.0.1:8000/predict", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      case_description: caseDescription,
    }),
  });

  if (!response.ok) {
    throw new Error("Prediction failed");
  }

  return response.json();
}
