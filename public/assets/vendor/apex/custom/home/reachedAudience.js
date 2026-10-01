var options = {
	series: [54, 36, 10],
	chart: {
		height: 282,
		type: "radialBar",
	},
	plotOptions: {
		radialBar: {
			dataLabels: {
				name: {
					fontSize: "22px",
				},
				value: {
					fontSize: "16px",
				},
				total: {
					show: true,
					label: "Total",
					formatter: function (w) {
						// By default this function returns the average of all series. The below is just an example to show the use of custom formatter function
						return 249;
					},
				},
			},
		},
	},
	labels: ["Men", "Women", "Other"],
	colors: ["#3659cd", "#a5acc3", "#dfe2ed"],
};

var chart = new ApexCharts(document.querySelector("#reachedAudience"), options);
chart.render();
