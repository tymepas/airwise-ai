export async function getDelhiAQI() {
  try {
    const response = await fetch(
      "https://api.openaq.org/v3/locations?country=IN&city=Delhi&limit=1",
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return data;
  } catch {
    return null;
  }
}