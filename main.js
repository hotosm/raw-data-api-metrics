const apiBaseUrl = "https://api-prod.raw-data.hotosm.org/v1";
let chartData = [];
let original_data;
let chart;

let metadataData = [];
let treemap;

function fetchMetadata() {
  const token = localStorage.getItem("rawdatApiOsmAccessToken");
  if (!token) {
    alert("Please login first.");
    return;
  }

  const metadataLoadingSpinner = document.getElementById(
    "metadataLoadingSpinner"
  );
  if (metadataLoadingSpinner) {
    metadataLoadingSpinner.style.display = "flex";
  }
  const startDate = document.getElementById("metaStartDate").value;
  const endDate = document.getElementById("metaEndDate").value;
  const groupBy = document.getElementById("metaGroupBy").value;

  // Get key prefixes from text input
  const keyPrefixInput = document.getElementById("keyPrefixInput");
  const prefixText = keyPrefixInput.value.trim();

  // Build the URL
  let url = `${apiBaseUrl}/metrics/meta-downloads?start_date=${startDate}&end_date=${endDate}&group_by=${groupBy}`;

  if (prefixText) {
    // The input may already be comma-separated, no need to join
    url += `&key_prefixes=${encodeURIComponent(prefixText)}`;
  }

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
      document.getElementById("metadataLoadingSpinner").style.display = "none";
      document.getElementById("metadataResultsSection").style.display = "block";

      metadataData = data;
      processMetadata(data);
    })
    .catch((error) => {
      document.getElementById("metadataLoadingSpinner").style.display = "none";

      console.error("Error:", error);
      if (error.message === "Unauthorized") {
        alert(
          "You don't have enough access. Please contact administrator for your access."
        );
      } else {
        alert("An error occurred while fetching metadata.");
      }
    });
}

function processMetadata(data) {
  // Flatten the data for table display
  const tableData = [];
  const hierarchicalData = { name: "root", children: [] };
  const folderMap = {};

  // Process each date bucket
  data.forEach((dateItem) => {
    const date = dateItem.kwdate.split("T")[0];
    const filesForDate = dateItem.downloads_by_file || {};

    // Process each file
    Object.entries(filesForDate).forEach(([filePath, downloadCount]) => {
      // Add to flat table data
      tableData.push({
        date,
        filePath,
        downloadCount,
      });

      // Process for hierarchical visualization
      const parts = filePath.split("/");
      let currentLevel = hierarchicalData;
      let currentPath = "";

      // Build the hierarchical structure
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (i === parts.length - 1) {
          // This is a file
          currentLevel.children.push({
            name: part,
            path: filePath,
            value: downloadCount,
          });
        } else {
          // This is a folder
          if (!folderMap[currentPath]) {
            const newFolder = { name: part, children: [] };
            currentLevel.children.push(newFolder);
            folderMap[currentPath] = newFolder;
          }
          currentLevel = folderMap[currentPath];
        }
      }
    });
  });

  // Create the visualization and table
  createTreemap(hierarchicalData);
  createMetadataTable(tableData);
}

function createTreemap(data) {
  const width = document.getElementById("treemapContainer").clientWidth;
  const height = 400;

  // Clear previous visualization
  d3.select("#treemapContainer").html("");

  const svg = d3
    .select("#treemapContainer")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  // Give the data a sensible structure for d3.treemap
  const root = d3
    .hierarchy(data)
    .sum((d) => d.value || 0)
    .sort((a, b) => b.value - a.value);

  // Create a treemap layout
  const treemap = d3.treemap().size([width, height]).padding(1).round(true);

  treemap(root);

  // Create a color scale
  const colorScale = d3
    .scaleSequential(d3.interpolateReds)
    .domain([0, d3.max(root.leaves(), (d) => d.value)]);

  // Create the treemap cells
  const cell = svg
    .selectAll("g")
    .data(root.leaves())
    .enter()
    .append("g")
    .attr("transform", (d) => `translate(${d.x0},${d.y0})`);

  // Add rectangles
  cell
    .append("rect")
    .attr("width", (d) => d.x1 - d.x0)
    .attr("height", (d) => d.y1 - d.y0)
    .attr("fill", (d) => colorScale(d.value))
    .attr("stroke", "#fff")
    .on("mouseover", function (event, d) {
      const tooltip = d3.select("#tooltip");
      tooltip
        .style("display", "block")
        .style("left", event.pageX + 10 + "px")
        .style(
          "top",
          event.pageY - 28 + "px"
        ).html(`<strong>Path:</strong> ${d.data.path}<br>
               <strong>Downloads:</strong> ${d.value}`);

      d3.select(this).attr("stroke", "#000").attr("stroke-width", 2);
    })
    .on("mouseout", function () {
      d3.select("#tooltip").style("display", "none");
      d3.select(this).attr("stroke", "#fff").attr("stroke-width", 1);
    });

  // Add labels
  cell
    .append("text")
    .attr("x", 3)
    .attr("y", 12)
    .text((d) => d.data.name.substring(0, (d.x1 - d.x0) / 7))
    .attr("font-size", "10px")
    .attr("fill", "white");
}

function createMetadataTable(data) {
  const tableContainer = document.getElementById("metadataTableContainer");
  tableContainer.innerHTML = "";

  // Add search box
  const searchDiv = document.createElement("div");
  searchDiv.className = "search-container";

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.id = "metadataSearch";
  searchInput.placeholder = "Search by file path...";
  searchInput.className = "search-input";

  const downloadBtn = document.createElement("button");
  downloadBtn.className = "btn secondary";
  downloadBtn.textContent = "Download CSV";
  downloadBtn.onclick = () => downloadMetadataCSV(data);

  searchDiv.appendChild(searchInput);
  searchDiv.appendChild(downloadBtn);
  tableContainer.appendChild(searchDiv);

  // Create table
  const table = document.createElement("table");
  table.id = "metadataTable";
  table.className = "display";
  table.style = "width:100%";

  tableContainer.appendChild(table);

  // Initialize DataTable
  $(document).ready(function () {
    const dataTable = $("#metadataTable").DataTable({
      data: data,
      columns: [
        { title: "Date", data: "date" },
        { title: "File Path", data: "filePath" },
        { title: "Downloads", data: "downloadCount" },
      ],
      order: [[2, "desc"]], // Sort by downloads
      pageLength: 25,
      responsive: true,
      scrollY: "50vh",
      scrollCollapse: true,
    });

    // Link external search box to DataTable
    $("#metadataSearch").on("keyup", function () {
      dataTable.search(this.value).draw();
    });
  });
}

function downloadMetadataCSV(data) {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "file_download_metrics.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

window.onload = function () {
  try {
    updateDateRange();

    // Initialize metadata date pickers as well
    const metaStartDate = document.getElementById("metaStartDate");
    const metaEndDate = document.getElementById("metaEndDate");
    if (metaStartDate && metaEndDate) {
      const endDate = new Date();
      let startDate = new Date();
      startDate.setMonth(endDate.getMonth() - 1); // Default to last month

      metaStartDate.valueAsDate = startDate;
      metaEndDate.valueAsDate = endDate;
    }

    const savedToken = localStorage.getItem("rawdatApiOsmAccessToken");
    if (savedToken) {
      fetchUserInfo(savedToken);
    }
  } catch (error) {
    console.error("Error in window.onload:", error);
  }
};

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
  const loadingSpinner = document.getElementById("loadingSpinner");
  if (loadingSpinner) {
    loadingSpinner.style.display = "flex";
  }
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;
  const groupBy = document.getElementById("groupBy").value;

  // Get multiple folder selections
  const folderSelect = document.getElementById("folderSelect");
  const selectedOptions = Array.from(folderSelect.selectedOptions).map(
    (option) => option.value
  );

  const allSelected = selectedOptions.includes("all");

  // If "all" is not selected, use the selected folders
  const selectedFolders = allSelected ? [] : selectedOptions;

  // Get checkbox values
  const includeLocations = document.getElementById("includeLocations").checked;
  const includeReferrers = document.getElementById("includeReferrers").checked;

  // Build the URL
  let url = `${apiBaseUrl}/metrics/summary?start_date=${startDate}&end_date=${endDate}&group_by=${groupBy}`;

  // Add folders if any are selected
  if (selectedFolders.length > 0) {
    url += `&folders=${selectedFolders.join(",")}`;
  }

  // Add optional parameters
  url += `&include_locations=${includeLocations}&include_referrers=${includeReferrers}`;

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
      document.getElementById("loadingSpinner").style.display = "none";

      original_data = data;
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
      document.getElementById("resultsSection").style.display = "block";
      document.getElementById("downloadBtn").style.display = "block";
      document.getElementById("chartmetricselector").style.display = "block";
    })
    .catch((error) => {
      document.getElementById("loadingSpinner").style.display = "none";

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
    if (key !== "kwdate" && typeof dataItem[key] !== "object") {
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

function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
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
    th.textContent = key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  data.forEach((row) => {
    const tr = document.createElement("tr");
    Object.keys(row).forEach((key) => {
      const td = document.createElement("td");
      let cellValue = row[key];
      if (key.toLowerCase().includes("size")) {
        cellValue = formatBytes(cellValue);
      } else if (typeof cellValue === "object") {
        cellValue = JSON.stringify(cellValue);
      }
      td.textContent = cellValue;
      td.title = cellValue; // Add tooltip
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  tableContainer.appendChild(table);

  $(document).ready(function () {
    $("#metricsDataTable").DataTable({
      responsive: true,
      searching: true,
      scrollY: "50vh",
      scrollCollapse: true,
      columns: Object.keys(data[0]).map((key) => ({ data: key })),
    });
  });
}

function downloadCSV() {
  const csv = Papa.unparse(original_data);
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

function showTab(tabName) {
  // Hide all tab content
  document.getElementById("dataSection").style.display = "none"; // Changed from summarySection
  document.getElementById("metadataSection").style.display = "none";
  document.getElementById("resultsSection").style.display = "none";
  document.getElementById("metadataResultsSection").style.display = "none";

  // Show selected tab
  if (tabName === "summary") {
    document.getElementById("dataSection").style.display = "block"; // Changed from summarySection
    if (chartData.length > 0) {
      document.getElementById("resultsSection").style.display = "block";
    }
  } else if (tabName === "metadata") {
    document.getElementById("metadataSection").style.display = "block";
    if (metadataData.length > 0) {
      document.getElementById("metadataResultsSection").style.display = "block";
    }
  }

  // Update tab buttons
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  document.getElementById(`${tabName}Tab`).classList.add("active");
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
      } - ${get_role(data.role)} (OSM ID : ${data.id})`;
      document.getElementById("loginForm").style.display = "none";
      document.getElementById("userInfo").style.display = "flex";
      document.getElementById("tabsContainer").style.display = "flex";
      document.getElementById("dataSection").style.display = "block"; // Changed from summarySection
      showTab("summary"); // Default to summary tab
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
  document.getElementById("tabsContainer").style.display = "none";
  document.getElementById("dataSection").style.display = "none"; // Changed from summarySection
  document.getElementById("metadataSection").style.display = "none";
  document.getElementById("resultsSection").style.display = "none";
  document.getElementById("metadataResultsSection").style.display = "none";
  document.getElementById("accessToken").value = "";
}
