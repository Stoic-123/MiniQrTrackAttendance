let token = localStorage.getItem("jwt");
const role = localStorage.getItem("role");
const staff_id = localStorage.getItem("staff_id");

// Redirect based on role
// if (role !== "admin" && window.location.pathname === "/") {
//   window.location.href = "/scan";
// }
// if (role !== "user" && window.location.pathname === "/scan") {
//   window.location.href = "/";
// }
// if (role !== "user" && window.location.pathname === "/staff") {
//   window.location.href = "/";
// }

// Show/hide links based on the user's role
if (role === "admin") {
  document.getElementById("adminLink").style.display = "block";
  document.getElementById("staffLink").style.display = "none";
  document.getElementById("scanLink").style.display = "none";
} else if (role === "user") {
  document.getElementById("staffLink").style.display = "block";
  document.getElementById("scanLink").style.display = "block";
  document.getElementById("adminLink").style.display = "none";
} else {
  document.getElementById("adminLink").style.display = "none";
  document.getElementById("staffLink").style.display = "none";
  document.getElementById("scanLink").style.display = "none";
}

// Function to generate QR code
function generateQR() {
  if (!token) {
    alert("Please log in first");
    window.location.href = "/login";
    return;
  }
  fetch("/qr/generate")
  .then((response) => response.json())
  .then((data) => {
    const qrCodeContainer = document.getElementById("qrCodeContainer");
    qrCodeContainer.innerHTML = `
      <img src="${data.qrImage}" alt="QR Code" />
      <button id="downloadBtn">Download</button>
    `;

    // Add event listener to the download button
    const downloadBtn = document.getElementById("downloadBtn");
    downloadBtn.addEventListener("click", () => {
      // Create a temporary anchor element
      const link = document.createElement("a");
      link.href = data.qrImage;
      link.download = "qr-code.png"; // Specify the filename for the downloaded image
      document.body.appendChild(link);
      link.click(); // Trigger the download
      document.body.removeChild(link); // Clean up
    });
  })
}

// Function to get the user's current location
function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser."));
      return;
    }

    const options = {
      enableHighAccuracy: true, // Use high accuracy mode
      timeout: 5000, // Maximum time to wait for location (in milliseconds)
      maximumAge: 0, // Do not use a cached position
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("Location retrieved successfully:", position);
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        console.error("Error retrieving location:", error);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error("User denied the request for Geolocation."));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error("Location information is unavailable."));
            break;
          case error.TIMEOUT:
            reject(new Error("The request to get user location timed out."));
            break;
          default:
            reject(new Error("An unknown error occurred."));
            break;
        }
      },
      options
    );
  });
}

// Initialize the HTML5 QR Code Scanner
function initQRScanner() {
  if (!token) {
    alert("Please log in first");
    window.location.href = "/login";
    return;
  }

  const qrScanner = new Html5QrcodeScanner(
    "qrScanner", // Container ID for the scanner
    {
      fps: 10, // Frames per second for scanning
      qrbox: { width: 250, height: 250 }, // Size of the QR code scanning box
    },
    false // Verbose mode (set to true for debugging)
  );

  qrScanner.render(
    async (decodedText) => {
      try {
        // Handle the QR code scan
        await handleQRCodeScan(decodedText, qrScanner);
      } catch (error) {
        console.error("Error handling QR code scan:", error);
        alert("An error occurred during scanning: " + error.message);
      }
    },
    (error) => {
      console.warn(`QR Code scanning failure: ${error}`);
    }
  );
}
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get("code");

if (code) {
  // If a code is found in the URL, auto-scan it
  handleQRCodeScan(code);
}

// Function to handle successful scans
async function handleQRCodeScan(decodedText, scanner = null) {
  if (!token) {
    alert("Please log in first");
    window.location.href = "/login";
    return;
  }

  try {
    // Extract the code from the decodedText
    let code;
    if (decodedText.startsWith("http")) {
      // If the decodedText is a URL, extract the code from the query parameters
      const url = new URL(decodedText);
      code = url.searchParams.get("code");
    } else {
      // If the decodedText is not a URL, assume it is the code itself
      code = decodedText;
    }

    if (!code) {
      throw new Error("Invalid QR code format. Could not extract code.");
    }

    // Get the user's current location
    const location = await getLocation();
    const { latitude, longitude } = location;

    // Extract staff_id from local storage or user session
    const staff_id = localStorage.getItem("staff_id");

    if (!staff_id || !code) {
      throw new Error("QR code is missing required data (staff_id or code).");
    }

    // Send the scanned QR code data and location to the backend
    const response = await fetch("/qr/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: code, // The QR code data
        staff_id: staff_id, // The staff_id extracted from local storage
        latitude: latitude, // User's latitude
        longitude: longitude, // User's longitude
      }),
    });

    // Check if the response is OK
    if (!response.ok) {
      const errorData = await response.json(); // Parse the error response
      throw new Error(errorData.error || "Failed to process QR code scan");
    }

    // Parse the successful response
    const data = await response.json();

    // Display success message to the user
    document.getElementById("statusMessage").textContent = data.message;
    alert("Scan successful: " + data.message);

    // Stop the scanner after a successful scan (if scanner exists)
    if (scanner) {
      scanner.clear();
    }
  } catch (error) {
    // Handle errors and display them to the user
    console.error("Error handling QR code scan:", error);
    document.getElementById("statusMessage").textContent =
      "Error: " + error.message;
    alert("An error occurred during scanning: " + error.message);

    // Stop the scanner even if an error occurs (if scanner exists)
    if (scanner) {
      scanner.clear();
    }
  }
}
// Logout functionality
document.getElementById("logout").addEventListener("click", async (e) => {
  e.preventDefault();
  let response = await fetch("/auth/logout", {
    method: "DELETE",
  });
  let data = await response.json();
  if (response.ok) {
    localStorage.removeItem("jwt");
    window.location.href = "/login";
  }
});

// Initialize the QR code scanner when the page loads
document.addEventListener("DOMContentLoaded", () => {
  initQRScanner();
});
