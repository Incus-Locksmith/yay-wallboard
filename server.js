app.get("/dispatch", async (req, res) => {
  try {
    const customerPostcode = (req.query.postcode || "").trim().toUpperCase();
    const jobType = (req.query.job_type || "").trim();

    let customerLocation = null;
    let customerLocationMessage = "";

    if (customerPostcode) {
      customerLocation = await lookupPostcodeLocation(customerPostcode);

      customerLocationMessage = customerLocation.ok
        ? `Customer postcode located using ${customerLocation.precision.toLowerCase()} postcode data.`
        : `Could not locate customer postcode: ${customerPostcode}`;
    }

    const result = await pool.query(`
      SELECT *
      FROM technicians
      WHERE active = TRUE
      ORDER BY updated_at DESC
    `);

    const candidates = result.rows.filter(tech => isUsableForDispatch(tech.status));

    const candidatesWithDistance = await Promise.all(
      candidates.map(async tech => {
        const location = getBestLocation(tech);
        const techLocation = await lookupPostcodeLocation(location.postcode);

        let distance = null;

        if (customerLocation && customerLocation.ok && techLocation && techLocation.ok) {
          distance = distanceMiles(
            customerLocation.latitude,
            customerLocation.longitude,
            techLocation.latitude,
            techLocation.longitude
          );
        }

        return {
          tech,
          location,
          techLocation,
          distance
        };
      })
    );

    candidatesWithDistance.sort((a, b) => {
      const statusDiff = dispatchRank(a.tech.status) - dispatchRank(b.tech.status);
      if (statusDiff !== 0) return statusDiff;

      const priorityDiff = priorityRank(a.tech.priority) - priorityRank(b.tech.priority);
      if (priorityDiff !== 0) return priorityDiff;

      if (a.distance !== null && b.distance === null) return -1;
      if (a.distance === null && b.distance !== null) return 1;
      if (a.distance !== null && b.distance !== null) return a.distance - b.distance;

      return new Date(b.tech.updated_at) - new Date(a.tech.updated_at);
    });

    const mapTechnicians = candidatesWithDistance
      .filter(item => item.techLocation && item.techLocation.ok)
      .map((item, index) => {
        const tech = item.tech;
        const status = tech.status || "";
        const priority = tech.priority || "Normal";

        return {
          rank: index + 1,
          name: tech.name || "",
          phone: tech.phone || "",
          status,
          priority,
          availableFrom: tech.available_from || "Now / check",
          locationPostcode: item.location.postcode || "",
          locationSource: item.location.source || "",
          skills: tech.skills || "",
          notes: tech.notes || "",
          distance: item.distance === null ? null : Number(item.distance.toFixed(1)),
          latitude: item.techLocation.latitude,
          longitude: item.techLocation.longitude
        };
      });

    const mapData = {
      customer: customerLocation && customerLocation.ok
        ? {
            postcode: customerPostcode,
            latitude: customerLocation.latitude,
            longitude: customerLocation.longitude,
            precision: customerLocation.precision
          }
        : null,
      technicians: mapTechnicians
    };

    const mapDataJson = JSON.stringify(mapData).replace(/</g, "\\u003c");

    const rows = candidatesWithDistance.map((item, index) => {
      const tech = item.tech;
      const statusClass = technicianStatusClass(tech.status);
      const priority = tech.priority || "Normal";
      const priorityBadgeClass = priorityClass(priority);

      const precision = item.techLocation.ok
        ? item.techLocation.precision
        : postcodePrecision(item.location.postcode);

      const precisionText = precision === "Approx"
        ? `<span class="warning-text">Approx</span>`
        : escapeHtml(precision);

      const distanceText = customerPostcode
        ? formatDistance(item.distance)
        : "Enter postcode";

      return `
        <tr>
          <td>${index + 1}</td>
          <td>
            <strong>${escapeHtml(tech.name)}</strong><br>
            <span class="muted">${escapeHtml(tech.phone)}</span>
          </td>
          <td><span class="pill ${statusClass}">${escapeHtml(tech.status)}</span></td>
          <td><span class="pill ${priorityBadgeClass}">${escapeHtml(priority)}</span></td>
          <td>${escapeHtml(tech.available_from || "Now / check")}</td>
          <td>
            ${escapeHtml(item.location.postcode || "No postcode")}
            <br>
            <span class="muted">${escapeHtml(item.location.source)} · ${precisionText}</span>
          </td>
          <td>
            <span class="distance">${distanceText}</span><br>
            <span class="muted">Straight-line estimate</span>
          </td>
          <td>${escapeHtml(tech.skills)}</td>
          <td>${escapeHtml(tech.notes)}</td>
          <td>${formatDateTimeWithSeconds(tech.updated_at)}</td>
        </tr>
      `;
    }).join("");

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Dispatch Postcode Map</title>

        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIINfQ5d1G1eoYkZrjZ9gHh7uKybqvDMcfM="
          crossorigin=""
        />

        <script
          src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
          integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
          crossorigin="">
        </script>

        <style>
          ${sharedStyles()}

          form.search {
            display: grid;
            grid-template-columns: 2fr 2fr 1fr;
            gap: 15px;
          }

          .notice {
            background: #1f2937;
            border-left: 5px solid #f59e0b;
            border-radius: 10px;
            padding: 18px;
            margin-bottom: 25px;
            color: #d1d5db;
          }

          .notice.good {
            border-left-color: #16a34a;
          }

          .notice.bad {
            border-left-color: #dc2626;
          }

          .map-layout {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 20px;
            margin-bottom: 28px;
          }

          #dispatch-map {
            height: 680px;
            width: 100%;
            border-radius: 16px;
            overflow: hidden;
            border: 1px solid #374151;
            background: #111827;
          }

          .map-side-panel {
            background: #1f2937;
            border-radius: 16px;
            border: 1px solid #374151;
            padding: 20px;
          }

          .legend-item {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 12px;
            color: #d1d5db;
            font-size: 14px;
          }

          .legend-dot {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            display: inline-block;
          }

          .dot-customer { background: #a855f7; }
          .dot-available { background: #16a34a; }
          .dot-soon { background: #f59e0b; }
          .dot-onjob { background: #2563eb; }
          .dot-other { background: #6b7280; }
          .dot-district { background: #fbbf24; }

          .map-note {
            margin-top: 18px;
            color: #9ca3af;
            line-height: 1.5;
            font-size: 14px;
          }

          .leaflet-popup-content {
            color: #111827;
            font-size: 14px;
            line-height: 1.45;
          }

          .leaflet-popup-content strong {
            font-size: 15px;
          }

          .marker-label {
            background: white;
            border: 2px solid #111827;
            border-radius: 999px;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #111827;
            font-weight: bold;
            font-size: 13px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.35);
          }

          .marker-customer {
            background: #a855f7;
            color: white;
          }

          .marker-available {
            background: #16a34a;
            color: white;
          }

          .marker-soon {
            background: #f59e0b;
            color: black;
          }

          .marker-onjob {
            background: #2563eb;
            color: white;
          }

          .marker-other {
            background: #6b7280;
            color: white;
          }

          .postcode-label {
            background: rgba(17, 24, 39, 0.88);
            color: #f9fafb;
            border: 1px solid rgba(251, 191, 36, 0.75);
            border-radius: 999px;
            padding: 3px 7px;
            font-size: 12px;
            font-weight: bold;
            box-shadow: 0 2px 8px rgba(0,0,0,0.35);
          }

          .loading-map {
            color: #9ca3af;
            font-size: 14px;
            margin-top: 12px;
          }

          @media (max-width: 1100px) {
            .map-layout {
              grid-template-columns: 1fr;
            }

            #dispatch-map {
              height: 560px;
            }
          }
        </style>
      </head>

      <body>
        ${nav(req)}

        <h1>Dispatch Postcode Map</h1>
        <div class="subtitle">London postcode district boundaries · Customer and technician positions</div>

        <div class="panel">
          <form class="search" method="GET" action="/dispatch">
            <input name="postcode" value="${escapeHtml(customerPostcode)}" placeholder="Customer postcode e.g. W13 8SB">
            <input name="job_type" value="${escapeHtml(jobType)}" placeholder="Job type e.g. lockout, uPVC">
            <button type="submit">Find Locksmith</button>
          </form>
        </div>

        ${
          customerPostcode
            ? `<div class="notice ${customerLocation && customerLocation.ok ? "good" : "bad"}">
                <strong>${escapeHtml(customerPostcode)}</strong> — ${escapeHtml(customerLocationMessage)}
                <br>
                Yellow boundary highlight shows the customer's postcode district where available.
              </div>`
            : `<div class="notice">
                Enter a customer postcode to highlight the London postcode district and plot nearby locksmiths.
              </div>`
        }

        <div class="map-layout">
          <div>
            <div id="dispatch-map"></div>
            <div class="loading-map" id="map-load-status">Loading postcode district boundaries...</div>
          </div>

          <div class="map-side-panel">
            <h2>Map Key</h2>

            <div class="legend-item">
              <span class="legend-dot dot-district"></span>
              Customer postcode district
            </div>

            <div class="legend-item">
              <span class="legend-dot dot-customer"></span>
              Customer postcode
            </div>

            <div class="legend-item">
              <span class="legend-dot dot-available"></span>
              Available technician
            </div>

            <div class="legend-item">
              <span class="legend-dot dot-soon"></span>
              Available soon
            </div>

            <div class="legend-item">
              <span class="legend-dot dot-onjob"></span>
              On job
            </div>

            <div class="legend-item">
              <span class="legend-dot dot-other"></span>
              Other usable status
            </div>

            <div class="map-note">
              <strong>Important:</strong><br>
              This is a postcode district view, closer to the CrystalRoof style.
              <br><br>
              It still shows straight-line distance, not driving time.
              <br><br>
              Technician position uses current postcode first, then base postcode.
            </div>
          </div>
        </div>

        <h2>Ranked Technician List</h2>

        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Technician</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Available From</th>
              <th>Location</th>
              <th>Distance</th>
              <th>Skills</th>
              <th>Notes</th>
              <th>Last Updated</th>
            </tr>
          </thead>

          <tbody>
            ${rows || `<tr><td colspan="10">No available technicians found</td></tr>`}
          </tbody>
        </table>

        <script>
          const mapData = ${mapDataJson};

          const postcodeAreaFiles = [
            "E",
            "EC",
            "N",
            "NW",
            "SE",
            "SW",
            "W",
            "WC"
          ];

          const postcodeGeoJsonBase =
            "https://raw.githubusercontent.com/missinglink/uk-postcode-polygons/master/geojson/";

          const map = L.map("dispatch-map", {
            scrollWheelZoom: true,
            preferCanvas: true
          });

          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors"
          }).addTo(map);

          const defaultLondonCentre = [51.5072, -0.1276];
          map.setView(defaultLondonCentre, 10);

          const bounds = [];
          const districtLayer = L.layerGroup().addTo(map);
          const labelLayer = L.layerGroup().addTo(map);
          const markerLayer = L.layerGroup().addTo(map);

          function safeText(value) {
            return String(value || "")
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
          }

          function postcodeDistrictFromText(value) {
            const clean = String(value || "")
              .toUpperCase()
              .replace(/[^A-Z0-9 ]/g, " ")
              .replace(/\\s+/g, " ")
              .trim();

            if (!clean) return "";

            if (clean.includes(" ")) {
              return clean.split(" ")[0];
            }

            const match = clean.match(/^([A-Z]{1,2}\\d[A-Z\\d]?)/);
            return match ? match[1] : clean;
          }

          function districtNameFromFeature(feature) {
            const props = feature.properties || {};

            const possibleValues = [
              props.name,
              props.Name,
              props.NAME,
              props.title,
              props.Title,
              props.description,
              props.Description,
              props.id,
              props.ID
            ];

            for (const value of possibleValues) {
              const text = String(value || "").toUpperCase();

              const match = text.match(/\\b(EC\\d[A-Z]?|WC\\d[A-Z]?|E\\d{1,2}[A-Z]?|N\\d{1,2}[A-Z]?|NW\\d{1,2}[A-Z]?|SE\\d{1,2}[A-Z]?|SW\\d{1,2}[A-Z]?|W\\d{1,2}[A-Z]?)\\b/);

              if (match) return match[1];
            }

            return "";
          }

          function markerClassForStatus(status) {
            const value = String(status || "").toLowerCase();

            if (value.includes("available") && !value.includes("soon")) {
              return "marker-available";
            }

            if (value.includes("soon")) {
              return "marker-soon";
            }

            if (value.includes("job")) {
              return "marker-onjob";
            }

            return "marker-other";
          }

          function makeNumberIcon(number, className) {
            return L.divIcon({
              className: "",
              html: '<div class="marker-label ' + className + '">' + number + '</div>',
              iconSize: [28, 28],
              iconAnchor: [14, 14],
              popupAnchor: [0, -14]
            });
          }

          function makePostcodeLabelIcon(label, isHighlighted) {
            return L.divIcon({
              className: "",
              html:
                '<div class="postcode-label" style="' +
                (isHighlighted ? 'background:#fbbf24;color:#111827;border-color:#111827;' : '') +
                '">' +
                safeText(label) +
                '</div>',
              iconSize: null,
              iconAnchor: [14, 10]
            });
          }

          const customerDistrict = mapData.customer
            ? postcodeDistrictFromText(mapData.customer.postcode)
            : "";

          function districtStyle(feature) {
            const district = districtNameFromFeature(feature);
            const isCustomerDistrict = district && district === customerDistrict;

            if (isCustomerDistrict) {
              return {
                color: "#fbbf24",
                weight: 4,
                opacity: 1,
                fillColor: "#fbbf24",
                fillOpacity: 0.28
              };
            }

            return {
              color: "#60a5fa",
              weight: 1.2,
              opacity: 0.65,
              fillColor: "#1d4ed8",
              fillOpacity: 0.08
            };
          }

          function addDistrictLabels(geoJsonLayer) {
            geoJsonLayer.eachLayer(function(layer) {
              if (!layer.feature) return;

              const district = districtNameFromFeature(layer.feature);
              if (!district) return;

              const isCustomerDistrict = district === customerDistrict;

              try {
                const centre = layer.getBounds().getCenter();

                L.marker(centre, {
                  icon: makePostcodeLabelIcon(district, isCustomerDistrict),
                  interactive: false
                }).addTo(labelLayer);
              } catch (error) {
                // Ignore label errors on odd geometries
              }
            });
          }

          async function loadPostcodeDistricts() {
            const status = document.getElementById("map-load-status");
            let loadedCount = 0;

            for (const area of postcodeAreaFiles) {
              try {
                const response = await fetch(postcodeGeoJsonBase + area + ".geojson");
                const geojson = await response.json();

                const geoJsonLayer = L.geoJSON(geojson, {
                  style: districtStyle,
                  onEachFeature: function(feature, layer) {
                    const district = districtNameFromFeature(feature);
                    const isCustomerDistrict = district && district === customerDistrict;

                    layer.bindPopup(
                      "<strong>Postcode district: " + safeText(district || area) + "</strong>" +
                      (isCustomerDistrict ? "<br>Customer area" : "")
                    );

                    layer.on("mouseover", function() {
                      layer.setStyle({
                        weight: isCustomerDistrict ? 5 : 3,
                        fillOpacity: isCustomerDistrict ? 0.35 : 0.16
                      });
                    });

                    layer.on("mouseout", function() {
                      geoJsonLayer.resetStyle(layer);
                    });
                  }
                });

                geoJsonLayer.addTo(districtLayer);
                addDistrictLabels(geoJsonLayer);
                loadedCount += 1;
              } catch (error) {
                console.error("Could not load postcode area", area, error);
              }
            }

            if (status) {
              status.textContent = loadedCount
                ? "Postcode district boundaries loaded."
                : "Could not load postcode district boundaries.";
            }
          }

          if (mapData.customer) {
            const customerLatLng = [
              mapData.customer.latitude,
              mapData.customer.longitude
            ];

            bounds.push(customerLatLng);

            L.marker(customerLatLng, {
              icon: makeNumberIcon("C", "marker-customer")
            })
              .addTo(markerLayer)
              .bindPopup(
                "<strong>Customer</strong><br>" +
                safeText(mapData.customer.postcode) +
                "<br>District: " + safeText(customerDistrict || "Unknown") +
                "<br>Precision: " + safeText(mapData.customer.precision)
              );
          }

          mapData.technicians.forEach(function(tech) {
            const latLng = [tech.latitude, tech.longitude];
            bounds.push(latLng);

            const distanceText = tech.distance === null
              ? "Distance unavailable"
              : tech.distance + " miles";

            const popupHtml =
              "<strong>#" + safeText(tech.rank) + " " + safeText(tech.name) + "</strong><br>" +
              safeText(tech.phone) + "<br><br>" +
              "<strong>Status:</strong> " + safeText(tech.status) + "<br>" +
              "<strong>Priority:</strong> " + safeText(tech.priority) + "<br>" +
              "<strong>Available:</strong> " + safeText(tech.availableFrom) + "<br>" +
              "<strong>Location:</strong> " + safeText(tech.locationPostcode) + " (" + safeText(tech.locationSource) + ")<br>" +
              "<strong>Distance:</strong> " + safeText(distanceText) + "<br>" +
              "<strong>Skills:</strong> " + safeText(tech.skills) + "<br>" +
              "<strong>Notes:</strong> " + safeText(tech.notes);

            L.marker(latLng, {
              icon: makeNumberIcon(tech.rank, markerClassForStatus(tech.status))
            })
              .addTo(markerLayer)
              .bindPopup(popupHtml);
          });

          if (bounds.length > 0) {
            map.fitBounds(bounds, {
              padding: [45, 45],
              maxZoom: 13
            });
          }

          loadPostcodeDistricts();
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Dispatch page error:", error);
    res.status(500).send("Dispatch page error. Check Render logs.");
  }
});
