const form = document.querySelector('form')
const fileButton = document.querySelector('#fileButton')
const fileInput = document.querySelector('#file')
const concButtons = document.querySelector('#concButtons')
const concHeading = document.querySelector('#concHeading')
const seasonButtons = document.querySelector('#seasonButtons')
const seasonHeading = document.querySelector('#seasonHeading')
const diurnalButtons = document.querySelector('#diurnalButtons')
const diurnalHeading = document.querySelector('#diurnalHeading')
const headings = document.querySelectorAll('.heading')

for (let heading of headings) heading.style.display = 'none'

let concChart, seasonalChart, averageSeasonalChart, diurnalChart, covidChart
let textFileUrl = null

fileButton.addEventListener('click', async function (e) {
	e.stopPropagation()
	e.preventDefault()
	for (let heading of headings) heading.style.display = 'none'

	const f = fileInput.files[0]
	/* f is a File */
	const file = await f.arrayBuffer()
	/* data is an ArrayBuffer */
	const data = parseData(file)
	console.log(data)
	const params = ['aqi']
	for (let param of data.params) params.push(param)
	if (seasonalChart) seasonalChart.destroy()
	if (concChart) concChart.destroy()
	if (averageSeasonalChart) averageSeasonalChart.destroy()
	if (diurnalChart) diurnalChart.destroy()
	if (covidChart) covidChart.destroy()

	const seasons = []
	for (let season in data.seasonData) seasons.push(season)

	renderConcButtons(data, params)
	renderSeasonButtons(data, seasons)
	renderDiurnalButtons(data)
	renderSeasonalData(data)
	renderCovidData(data)
	for (let heading of headings) heading.style.display = 'block'

	let dataStr = ''
	for (let day of data.days) {
		dataStr += `${day.date} ${day.average.aqi} \n`
	}
	textFileUrl = null
	document.getElementById('downloadLink').href = generateTextFileUrl(dataStr)

	console.log(data)
})

// covid data
function renderCovidPlot(data) {
	const ctx = document.getElementById('covidChart').getContext('2d')
	if (covidChart) covidChart.destroy()
	const colors = [
		'rgba(255, 99, 132, 1)',
		'rgba(54, 162, 235, 1)',
		'rgba(75, 192, 192, 1)',
		'#e5e5e5',
		'#52b788',
		'#ffc8dd',
	]
	let c = 0
	const l = colors.length
	const datasets = []
	for (let d of data.plotData) {
		datasets.push({
			label: d.title,
			data: d.plotData,
			backgroundColor: colors[c++ % l],
			borderWidth: 1,
		})
	}

	covidChart = new Chart(ctx, {
		type: 'bar',
		data: {
			labels: data.labels,
			datasets,
		},
		options: {
			responsive: true,
			scales: {
				x: {
					title: {
						display: true,
						text: 'Parameter',
						font: {
							size: 16,
						},
					},
				},
				y: {
					title: {
						display: true,
						text: `Concentration ug/m3 `,
						font: {
							size: 16,
						},
					},
				},
			},
		},
		plugins: {
			datalabels: {
				color: function (ctx) {
					// use the same color as the border
					return ctx.dataset.backgroundColor
				},
			},
		},
	})
}

function renderCovidData(data) {
	const res = {}
	res.title = `Covid vs Pre-Covid Analysis`
	res.labels = []
	res.plotData = []
	const covidData = data.covidData

	const unwanted = new Set()
	unwanted.add('Temp')
	unwanted.add('RH')
	unwanted.add('WS')
	unwanted.add('WD')
	for (let param in covidData.pre) if (!unwanted.has(param)) res.labels.push(param)

	const d1 = {}
	d1.title = 'pre Covid'
	d1.plotData = []
	for (let param in covidData.pre) {
		const p = covidData.pre[param]
		if (unwanted.has(param) || p === 0) continue
		d1.plotData.push(p.average)
	}
	res.plotData.push(d1)

	const d2 = {}
	d2.title = 'post Covid'
	d2.plotData = []
	for (let param in covidData.post) {
		const p = covidData.post[param]
		if (unwanted.has(param) || p === 0) continue
		d2.plotData.push(p.average)
	}
	res.plotData.push(d2)

	console.log(res)
	renderCovidPlot(res)
}

// diurnal plots
function plotDiurnalData(data) {
	const ctx = document.getElementById('diurnalChart').getContext('2d')
	if (diurnalChart) diurnalChart.destroy()
	const colors = [
		'rgba(255, 99, 132, 1)',
		'rgba(54, 162, 235, 1)',
		'rgba(75, 192, 192, 1)',
		'#e5e5e5',
		'#52b788',
		'#ffc8dd',
	]
	let c = 0
	const l = colors.length
	const datasets = []
	for (let d of data.plotData) {
		datasets.push({
			label: d.title,
			data: d.plotData,
			backgroundColor: colors[c++ % l],
			borderWidth: 1,
		})
	}

	diurnalChart = new Chart(ctx, {
		type: 'bar',
		data: {
			labels: data.labels,
			datasets,
		},
		options: {
			responsive: true,
			scales: {
				yAxes: {
					type: 'time',
					time: {
						unit: 'hour',
						displayFormats: {
							hour: 'HH:mm',
						},
					},
					min: moment('00:00', 'HH:mm')._d,
					tooltips: {
						callback: function (t) {
							return 'hello'
						},
					},
				},
				x: {
					title: {
						display: true,
						text: 'Month',
						font: {
							size: 16,
						},
					},
				},
				y: {
					title: {
						display: true,
						text: `Peak Hour`,
						font: {
							size: 16,
						},
					},
					type: 'time',
					time: {
						unit: 'hour',
						displayFormats: {
							hour: 'HH:mm',
						},
					},
					min: moment('00:00', 'HH:mm')._d,
				},
			},
		},
		plugins: {
			datalabels: {
				color: function (ctx) {
					// use the same color as the border
					return ctx.dataset.backgroundColor
				},
			},
		},
	})
}

function getDiurnalData(data, param) {
	const res = {}
	res.title = `Average Diurnal Data`
	res.labels = []
	res.plotData = []

	const monthData = data.monthData
	const unwanted = new Set()
	unwanted.add('Temp')
	unwanted.add('RH')
	unwanted.add('WS')
	unwanted.add('WD')
	let y = null
	for (let month in monthData) {
		if (y === null) y = month
		const d = {}
		d.title = month
		d.plotData = []
		for (let year in monthData[month]) {
			const p = monthData[month][year].peak[param].time
			if (unwanted.has(param) || p === '') continue
			d.plotData.push(moment(p, 'HH:mm')._d)
		}
		res.plotData.push(d)
	}
	for (let m in monthData[y]) {
		res.labels.push(m)
	}
	return res
}

function renderDiurnalButtons(data) {
	diurnalButtons.innerHTML = ''

	let def
	for (let param of data.params) {
		const newButton = document.createElement('button')
		newButton.innerText = param.toUpperCase()
		newButton.addEventListener('click', function (e) {
			const plotData = getDiurnalData(data, param)
			console.log(plotData)
			plotDiurnalData(plotData)
			diurnalHeading.innerText = param.toUpperCase()
		})
		if (!def) def = param

		diurnalButtons.appendChild(newButton)
	}
	const plotData = getDiurnalData(data, def)
	plotDiurnalData(plotData)
	diurnalHeading.innerText = def.toUpperCase()
}

// Function for generating a text file URL containing given text
function generateTextFileUrl(txt) {
	let fileData = new Blob([txt], { type: 'text/plain' })
	// If a file has been previously generated, revoke the existing URL
	if (textFileUrl !== null) {
		window.URL.revokeObjectURL(txt)
	}
	textFileUrl = window.URL.createObjectURL(fileData)
	// Returns a reference to the global variable holding the URL
	// Again, this is better than generating and returning the URL itself from the function as it will eat memory if the file contents are large or regularly changing
	return textFileUrl
}

// seasonal plots
function getAverageSeasonalData(data) {
	const res = {}
	res.title = `Seasonal Data`
	res.labels = []
	res.plotData = []

	const seasonData = data.seasonData
	const unwanted = new Set()
	unwanted.add('Temp')
	unwanted.add('RH')
	unwanted.add('WS')
	unwanted.add('WD')
	let y = null
	for (let season in seasonData) {
		if (y === null) y = season
		const d = {}
		d.title = season
		d.plotData = []
		for (let param in seasonData[season].average) {
			if (unwanted.has(param)) continue
			d.plotData.push(seasonData[season].average[param].average)
		}
		res.plotData.push(d)
	}
	for (let param in seasonData[y].average) {
		if (unwanted.has(param)) continue
		res.labels.push(param)
	}
	return res
}

function renderSeasonalData(data) {
	const plotData = getAverageSeasonalData(data)
	renderAverageSeasonalPlot(plotData)
}

function renderAverageSeasonalPlot(data) {
	const ctx = document.getElementById('averageSeasonalChart').getContext('2d')
	if (averageSeasonalChart) averageSeasonalChart.destroy()
	const colors = [
		'rgba(255, 99, 132, 1)',
		'rgba(54, 162, 235, 1)',
		'rgba(75, 192, 192, 1)',
		'#e5e5e5',
		'#52b788',
		'#ffc8dd',
	]
	let c = 0
	const l = colors.length
	const datasets = []
	for (let d of data.plotData) {
		datasets.push({
			label: d.title,
			data: d.plotData,
			backgroundColor: colors[c++ % l],
			borderWidth: 1,
		})
	}

	averageSeasonalChart = new Chart(ctx, {
		type: 'bar',
		data: {
			labels: data.labels,
			datasets,
		},
		options: {
			responsive: true,
			scales: {
				x: {
					title: {
						display: true,
						text: 'parameter',
						font: {
							size: 16,
						},
					},
				},
				y: {
					title: {
						display: true,
						text: `Concentration (μg/m3)`,
						font: {
							size: 16,
						},
					},
				},
			},
		},
		plugins: {
			datalabels: {
				color: function (ctx) {
					// use the same color as the border
					return ctx.dataset.backgroundColor
				},
			},
		},
	})
}

function getSeasonData(data, season) {
	const res = {}
	res.title = `${season} Data`
	res.labels = []
	res.plotData = []

	const unwanted = new Set()
	unwanted.add('Temp')
	unwanted.add('RH')
	unwanted.add('WS')
	unwanted.add('WD')

	let y = null
	const seasonData = data.seasonData[season]
	for (let year in seasonData) {
		if (isNaN(parseInt(year))) continue
		if (y === null) y = year

		const d = {}
		d.title = year
		d.plotData = []

		for (let param in seasonData[year]) {
			if (unwanted.has(param)) continue
			d.plotData.push(seasonData[year][param].average)
		}
		res.plotData.push(d)
	}
	for (let param in seasonData[y]) {
		if (unwanted.has(param)) continue
		res.labels.push(param)
	}
	return res
}

function renderSeasonButtons(data, seasons) {
	seasonButtons.innerHTML = ''

	let def
	for (let season of seasons) {
		if (!def) def = season

		const newButton = document.createElement('button')
		newButton.innerText = season.toUpperCase()
		newButton.addEventListener('click', function (e) {
			const plotData = getSeasonData(data, season)
			plotSeasonalData(plotData)
			seasonHeading.innerText = season.toUpperCase()
		})
	}
	const plotData = getSeasonData(data, def)
	plotSeasonalData(plotData)
	seasonHeading.innerText = def.toUpperCase()
}

function randomEl(arr) {
	const i = Math.floor(Math.random() * arr.length)
	return arr[i]
}

function plotSeasonalData(data) {
	console.log(data)
	const ctx = document.getElementById('seasonalChart').getContext('2d')
	if (seasonalChart) seasonalChart.destroy()
	const colors = [
		'rgba(255, 99, 132, 1)',
		'rgba(54, 162, 235, 1)',
		'rgba(75, 192, 192, 1)',
		'#e5e5e5',
		'#52b788',
		'#ffc8dd',
	]
	let c = 0
	const l = colors.length
	const datasets = []
	for (let d of data.plotData) {
		datasets.push({
			label: d.title,
			data: d.plotData,
			backgroundColor: colors[c++ % l],
			borderWidth: 1,
		})
	}

	seasonalChart = new Chart(ctx, {
		type: 'bar',
		data: {
			labels: data.labels,
			datasets,
		},
		options: {
			responsive: true,
			scales: {
				x: {
					title: {
						display: true,
						text: 'parameter',
						font: {
							size: 16,
						},
					},
				},
				y: {
					title: {
						display: true,
						text: `Concentration (μg/m3)`,
						font: {
							size: 16,
						},
					},
				},
			},
		},
		plugins: {
			datalabels: {
				color: function (ctx) {
					// use the same color as the border
					return ctx.dataset.fillColor
				},
			},
		},
	})
}

// parameters plots
function getConcPlotData(data, param) {
	const res = {}
	const labels = [],
		plotData = []
	for (let day of data.days) {
		if (day.average[param] === 0) continue
		labels.push(day.date)
		plotData.push(day.average[param])
	}
	;(res.labels = labels), (res.plotData = plotData), (res.title = param)
	return res
}

function renderConcButtons(data, params) {
	concButtons.innerHTML = ''
	let def = 'aqi'
	for (let param of params) {
		const newButton = document.createElement('button')
		newButton.innerText = param.toUpperCase()
		newButton.addEventListener('click', function (e) {
			const plotData = getConcPlotData(data, param)
			renderConcChart(plotData)
			concHeading.innerText = param.toUpperCase()
		})

		concButtons.appendChild(newButton)
	}
	const plotData = getConcPlotData(data, def)
	renderConcChart(plotData)
	concHeading.innerText = def.toUpperCase()
}

function renderConcChart(data) {
	const ctx = document.getElementById('chart').getContext('2d')
	if (concChart) concChart.destroy()
	concChart = new Chart(ctx, {
		type: 'line',
		data: {
			labels: data.labels,
			datasets: [
				{
					label: data.title,
					data: data.plotData,
					borderColor: ['rgba(54, 162, 235, 1)'],
					borderWidth: 1,
					pointRadius: 1,
				},
			],
		},
		options: {
			responsive: true,
			scales: {
				x: {
					title: {
						display: true,
						text: 'Date',
						font: {
							size: 16,
						},
					},
				},
				y: {
					title: {
						display: true,
						text:
							data.title === 'aqi'
								? 'AQI Index'
								: `${data.title} concentration (μg/m3)`,
						font: {
							size: 16,
						},
					},
				},
			},
		},
	})
}
