const apiBaseUrl = "https://api-prod.raw-data.hotosm.org/v1";
let chartData = [];
let chart;

function generateAuthToken() {
  const authLoginUrl = `${apiBaseUrl}/auth/login/`;
  fetch(authLoginUrl)
    .then((response) => response.json())
    .then((data) => {
      if (data.login_url) {
        const loginMessage = document.getElementById("loginMessage");
        loginMessage.innerHTML = `<a href="${data.login_url}" target="_blank">Click here to login</a> and copy your token.`;
      } else {
        alert("Failed to generate login link. Please check the API base URL.");
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      alert("An error occurred while generating the login link.");
    });
}

function login() {
  const token = document.getElementById("accessToken").value;
  if (token) {
    localStorage.setItem("rawdatApiOsmAccessToken", token);
    fetchUserInfo(token);
  } else {
    alert("Please enter a valid token.");
  }
}
function get_role(role) {
  if (role == 1) {
    return "Admin";
  }
  if (role == 2) {
    return "Staff";
  }
  if (role == 3) {
    return "Guest";
  }
}

function fetchUserInfo(token) {
  fetch(`${apiBaseUrl}/auth/me/`, {
    headers: {
      accept: "application/json",
      "access-token": token,
    },
  })
    .then((response) => response.json())
    .then((data) => {
      document.getElementById("userImage").src = data.img_url;
      document.getElementById("userName").textContent = `Hi, ${
        data.username
      } (${get_role(data.role)})`;
      document.getElementById("loginForm").style.display = "none";
      document.getElementById("userInfo").style.display = "flex";
      document.getElementById("dataSection").style.display = "block";
      updateDateRange();
    })
    .catch((error) => {
      console.error("Error:", error);
      alert("Failed to fetch user info. Please check your access token.");
      localStorage.removeItem("rawdatApiOsmAccessToken");
    });
}

function logout() {
  localStorage.removeItem("rawdatApiOsmAccessToken");
  document.getElementById("loginForm").style.display = "block";
  document.getElementById("userInfo").style.display = "none";
  document.getElementById("dataSection").style.display = "none";
  document.getElementById("chartmetricselector").style.display = "none";
  document.getElementById("accessToken").value = "";
}

function updateDateRange() {
  const groupBy = document.getElementById("quickDateSelect").value;
  const endDate = new Date();
  let startDate = new Date();

  switch (groupBy) {
    case "day":
      startDate.setDate(endDate.getDate() - 1);
      break;
    case "month":
      startDate.setMonth(endDate.getMonth() - 1);
      break;
    case "quarter":
      startDate.setMonth(endDate.getMonth() - 3);
      break;
    case "year":
      startDate.setFullYear(endDate.getFullYear() - 1);
      break;
  }

  document.getElementById("startDate").valueAsDate = startDate;
  document.getElementById("endDate").valueAsDate = endDate;
}

function fetchData() {
  const token = localStorage.getItem("rawdatApiOsmAccessToken");
  if (!token) {
    alert("Please login first.");
    return;
  }

  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;
  const groupBy = document.getElementById("groupBy").value;

  const url = `${apiBaseUrl}/metrics/summary?start_date=${startDate}&end_date=${endDate}&group_by=${groupBy}`;

  fetch(url, {
    headers: {
      accept: "application/json",
      "access-token": token,
    },
  })
    .then((response) => {
      if (response.status === 401) {
        throw new Error("Unauthorized");
      }
      return response.json();
    })
    .then((data) => {
      const processedData = data.map((item) => {
        if (item.kwdate) {
          item.kwdate = item.kwdate.split("T")[0];
        }
        return item;
      });
      chartData = processedData;
      createMetricSelectors(processedData[0]);
      createChart(processedData);
      createTable(processedData);
      document.getElementById("downloadBtn").style.display = "block";
      document.getElementById("chartmetricselector").style.display = "block";
    })
    .catch((error) => {
      console.error("Error:", error);
      if (error.message === "Unauthorized") {
        alert(
          "You don't have enough access. Please contact administrator for your access."
        );
      } else {
        alert("An error occurred while fetching data.");
      }
    });
}

function createMetricSelectors(dataItem) {
  const selector = document.getElementById("metricSelector");
  selector.innerHTML = "";
  Object.keys(dataItem).forEach((key) => {
    if (key !== "kwdate") {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = key;
      selector.appendChild(option);
    }
  });
}

function createChart(data) {
  const ctx = document.getElementById("chartContainer");
  ctx.innerHTML = "<canvas></canvas>";
  const canvas = ctx.querySelector("canvas");

  const metricSelector = document.getElementById("metricSelector");
  const selectedMetric = metricSelector.value;

  chart = new Chart(canvas, {
    type: "line",
    data: {
      labels: data.map((item) => item.kwdate),
      datasets: [
        {
          label: selectedMetric,
          data: data.map((item) => item[selectedMetric]),
          borderColor: "#ff0000",
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      title: {
        display: true,
        text: "Raw Data API Metrics",
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: "Date",
          },
        },
        y: {
          display: true,
          title: {
            display: true,
            text: "Value",
          },
        },
      },
    },
  });
}

function updateChart() {
  const selectedMetric = document.getElementById("metricSelector").value;
  chart.data.datasets[0].label = selectedMetric;
  chart.data.datasets[0].data = chartData.map((item) => item[selectedMetric]);
  chart.update();
}

function createTable(data) {
  const tableContainer = document.getElementById("tableContainer");
  tableContainer.innerHTML = "";

  const table = document.createElement("table");
  table.id = "metricsDataTable";
  table.className = "display";
  table.style = "width:100%";
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");

  const headerRow = document.createElement("tr");
  Object.keys(data[0]).forEach((key) => {
    const th = document.createElement("th");
    th.textContent = key;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  table.appendChild(thead);
  table.appendChild(tbody);
  tableContainer.appendChild(table);

  $(document).ready(function () {
    $("#metricsDataTable").DataTable({
      data: data,
      responsive: true,
      searching: false,
      columns: Object.keys(data[0]).map((key) => ({ data: key })),
    });
  });
}

function downloadCSV() {
  const csv = Papa.unparse(chartData);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "raw_osm_data_metrics.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

window.onload = function () {
  updateDateRange();

  const savedToken = localStorage.getItem("rawdatApiOsmAccessToken");
  if (savedToken) {
    fetchUserInfo(savedToken);
  }
};
