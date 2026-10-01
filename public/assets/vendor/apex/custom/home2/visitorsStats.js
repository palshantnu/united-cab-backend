var options = {
	chart: {
		height: 350,
		type: "line",
		toolbar: {
			show: false,
		},
	},
	dataLabels: {
		enabled: false,
	},
	stroke: {
		curve: "smooth",
		width: 6,
	},
	series: [
		{
			name: "Trips",
			data: [
				10000, 40000, 15000, 40000, 20000, 35000, 20000, 10000, 31000, 43000,
				56000, 29000,
			],
		},
	],
	grid: {
		borderColor: "#dfd6ff",
		strokeDashArray: 5,
		xaxis: {
			lines: {
				show: true,
			},
		},
		yaxis: {
			lines: {
				show: false,
			},
		},
	},
	xaxis: {
		categories: [
			"Jan",
			"Feb",
			"Mar",
			"Apr",
			"May",
			"Jun",
			"Jul",
			"Aug",
			"Sep",
			"Oct",
			"Nov",
			"Dec",
		],
	},
	yaxis: {
		labels: {
			show: true,
		},
	},
	fill: {
		type: "gradient",
		gradient: {
			shade: "dark",
			gradientToColors: ["#e65729"],
			shadeIntensity: 1,
			type: "horizontal",
			opacityFrom: 1,
			opacityTo: 1,
			stops: [0, 100, 100, 100],
		},
	},
};

var chart = new ApexCharts(document.querySelector("#visitorsStats"), options);

chart.render();
