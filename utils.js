function parseData(file) {
	// reading the excel file
	const workbook = XLSX.read(file)
	const sheet = workbook.Sheets.Sheet1
	const data = []

	for (let key in sheet) {
		data.push([key, sheet[key]])
	}

	// getting all rows from the file
	const rows = []
	for (let i = 0; i < data.length; ) {
		if (data[i][0][0] != 'A') {
			i++
			continue
		}
		let j = i + 1
		const row = []
		row.push(data[i][1].w)
		while (j < data.length && data[j][0][0] != 'A') {
			row.push(data[j][1].w)
			j++
		}
		rows.push(row)
		i = j
	}

	// separating the rows into individual date objects
	const Data = {}
	let id = -1,
		ids = [null, null]

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i]
		if (row[0] === 'Station') {
			Data.station = row[1]
		}
		if (row[0] === 'From Date') {
			id = i + 1
			for (let j = 2; j < row.length; j++) ids[j] = row[j]
		}
	}

	const days = []
	for (let i = id; i < rows.length; i++) {
		const row = rows[i]
		const curr = {
			date: row[0].split(' ')[0],
		}
		const day_data = {
			from: row[0].split(' ')[1],
			to: row[1].split(' ')[1],
		}

		for (let j = 2; j < row.length; j++) {
			if (row[j]) day_data[ids[j]] = row[j] == 'None' ? 0 : parseInt(row[j])
		}

		if (days.length === 0 || days[days.length - 1].date !== curr.date) {
			curr.data = [day_data]
			days.push(curr)
		} else {
			days[days.length - 1].data.push(day_data)
		}
	}
	Data.days = days
	Data.params = ids.splice(2)

	// average concentration for each pollutant for a given day
	for (let day of Data.days) {
		const average = {}
		for (let param of Data.params) {
			let sum = 0,
				n = 0
			for (let hour of day.data) {
				if (hour[param] != 0) {
					sum += hour[param]
					n++
				}
			}
			average[param] = n == 0 ? 0 : sum / n
		}
		day.average = average
		day.average.aqi = AQI(average)
	}

	// number of good and bad days
	let good = 0,
		poor = 0
	for (let day of Data.days) {
		if (day.average.aqi === 0) continue
		if (day.average.aqi <= 50) good++
		if (day.average.aqi > 200) poor++
	}
	;(Data.goodDays = good), (Data.poorDays = poor)

	// average concentrations for different seasons
	const seasons = [
		'winter',
		'winter',
		'spring',
		'spring',
		'summer',
		'summer',
		'monsoon',
		'monsoon',
		'autumn',
		'autumn',
		'winter',
		'winter',
	]

	const season_data = {
		spring: {
			start: 'March',
			end: 'April',
		},
		summer: {
			start: 'May',
			end: 'June',
		},
		monsoon: {
			start: 'July',
			end: 'August',
		},
		autumn: {
			start: 'September',
			end: 'October',
		},
		winter: {
			start: 'November',
			end: 'February',
		},
	}

	const start_year = parseInt(Data.days[0].date.split('-')[2]),
		end_year = parseInt(Data.days[Data.days.length - 1].date.split('-')[2])

	const obj = {}
	for (let year = start_year; year <= end_year; year++) {
		obj[year] = {}
		for (let param of Data.params) {
			obj[year][param] = { sum: 0, count: 0 }
		}
		obj[year].aqi = { sum: 0, count: 0 }
	}

	for (let season in season_data) {
		season_data[season] = { ...season_data[season], ...JSON.parse(JSON.stringify(obj)) }
	}

	for (let day of Data.days) {
		const month = parseInt(day.date.split('-')[1]),
			year = parseInt(day.date.split('-')[2]),
			season = seasons[month - 1]
		if (day.average.aqi !== 0) {
			season_data[season][year].aqi.count++,
				(season_data[season][year].aqi.sum += day.average.aqi)
		}
		for (let param of Data.params) {
			if (day.average[param] === 0) continue
			season_data[season][year][param].count++
			season_data[season][year][param].sum += day.average[param]
		}
	}
	for (let season of seasons) {
		for (let year = start_year; year <= end_year; year++) {
			const { sum, count } = season_data[season][year].aqi
			if (count !== 0) season_data[season][year].aqi.average = sum / count
			for (let param of Data.params) {
				const { sum, count } = season_data[season][year][param]
				if (count === 0) continue
				season_data[season][year][param].average = sum / count
			}
		}
	}

	for (let season in season_data) {
		const seasonData = season_data[season]
		const average = {}
		for (let param of Data.params) average[param] = { sum: 0, count: 0 }
		average.aqi = { sum: 0, count: 0 }
		for (let year = start_year; year <= end_year; year++) {
			for (let param in seasonData[year]) {
				average[param].count += seasonData[year][param].count
				average[param].sum += seasonData[year][param].sum
			}
		}
		for (let param in average) {
			if (average[param].count !== 0) {
				average[param].average = average[param].sum / average[param].count
			}
			delete average[param].sum
			delete average[param].count
		}
		seasonData.average = average
	}

	for (let season of seasons) {
		for (let year = start_year; year <= end_year; year++) {
			delete season_data[season][year].aqi.sum
			delete season_data[season][year].aqi.count

			for (let param of Data.params) {
				if (!season_data[season][year][param].average)
					season_data[season][year][param].average = 0
				delete season_data[season][year][param].sum
				delete season_data[season][year][param].count
			}
		}
	}
	Data.seasonData = season_data

	// diurnal analysis
	const months = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December',
	]
	const monthData = {}
	for (let year = start_year; year <= end_year; year++) {
		monthData[year] = {}
		for (let month of months) {
			monthData[year][month] = {}
		}
	}
	for (let day of Data.days) {
		const arr = day.date.split('-')
		const month = months[parseInt(arr[1]) - 1],
			year = parseInt(arr[2])
		const d = monthData[year][month]
		for (let hour of day.data) {
			if (!d[hour.from]) d[hour.from] = {}
			const dd = d[hour.from]
			for (let param of Data.params) {
				if (!dd[param]) dd[param] = { count: 0, sum: 0 }
				if (hour[param] === 0) continue
				dd[param].count++, (dd[param].sum += hour[param])
			}
		}
	}
	console.log(monthData)
	for (let y in monthData) {
		const year = monthData[y]
		for (let m in year) {
			const month = year[m]
			for (let h in month) {
				const hour = month[h]
				for (let p in hour) {
					const param = hour[p]
					param.average = 0
					if (param.count) param.average = param.sum / param.count
					delete param.count
					delete param.sum
				}
			}
			month.peak = {}
			for (let p of Data.params) {
				month.peak[p] = { time: '', conc: 0 }
				for (let h in month) {
					const hour = month[h]
					if (hour[p].average === 0) continue
					if (hour[p].average > month.peak[p].conc) {
						month.peak[p].conc = hour[p].average
						month.peak[p].time = h
					}
				}
			}
			for (let h in month) if (h !== 'peak') delete month[h]
		}
	}
	Data.monthData = monthData

	// covid and pre covid analysis
	const covidData = { pre: {}, post: {} }
	for (let param in Data.days[0].average) {
		covidData.pre[param] = { count: 0, sum: 0 }
		covidData.post[param] = { count: 0, sum: 0 }
	}
	for (let day of Data.days) {
		const year = parseInt(day.date.split('-')[2])
		for (let param in day.average) {
			if (day.average[param] === 0) continue
			if (year <= 2019) {
				covidData.pre[param].count++
				covidData.pre[param].sum += day.average[param]
			} else {
				covidData.post[param].count++
				covidData.post[param].sum += day.average[param]
			}
		}
	}

	for (let param in covidData.pre) {
		if (covidData.pre[param].count !== 0) {
			const { sum, count } = covidData.pre[param]
			covidData.pre[param].average = sum / count
			delete covidData.pre[param].count
			delete covidData.pre[param].sum
		}
		if (covidData.post[param].count !== 0) {
			const { sum, count } = covidData.post[param]
			covidData.post[param].average = sum / count
			delete covidData.post[param].count
			delete covidData.post[param].sum
		}
	}

	Data.covidData = covidData

	return Data
}

const params = ['PM10', 'PM2.5', 'SO2', 'NO2', 'Ozone', 'CO', 'NH3']
const AQI_params = new Set(params)
const aqi = [
	[0, 50],
	[51, 100],
	[101, 200],
	[201, 300],
	[301, 400],
	[401, 1000],
]

const BreakpointConcentrations = {
	PM10: {
		aqi: aqi,
		conc: [
			[0, 50],
			[51, 100],
			[101, 250],
			[251, 350],
			[351, 430],
			[431, 1000],
		],
	},
	'PM2.5': {
		aqi: aqi,
		conc: [
			[0, 30],
			[31, 60],
			[61, 90],
			[91, 120],
			[121, 250],
			[251, 1000],
		],
	},
	SO2: {
		aqi: aqi,
		conc: [
			[0, 40],
			[41, 80],
			[81, 380],
			[381, 800],
			[801, 1600],
			[1601, 1000],
		],
	},
	NO2: {
		aqi: aqi,
		conc: [
			[0, 40],
			[41, 80],
			[81, 180],
			[181, 280],
			[281, 400],
			[401, 1000],
		],
	},
	Ozone: {
		aqi: aqi,
		conc: [
			[0, 50],
			[51, 100],
			[101, 168],
			[169, 208],
			[209, 748],
			[749, 1000],
		],
	},
	CO: {
		aqi: aqi,
		conc: [
			[0, 1],
			[1.1, 2],
			[2.1, 10],
			[10, 17],
			[17, 34],
			[35, 1000],
		],
	},
	NH3: {
		aqi: aqi,
		conc: [
			[0, 200],
			[201, 400],
			[401, 800],
			[801, 1200],
			[1200, 1800],
			[1801, 1000],
		],
	},
}

const AQI = (params) => {
	let mx = 0
	for (let param in params) {
		if (!AQI_params.has(param) || (AQI_params.has(param) && params[param] == 0)) continue

		// take this aram
		const concentrations = BreakpointConcentrations[param]
		let B_LO,
			B_HI,
			I_LO,
			I_HI,
			I = 0
		for (let i = 0; i < concentrations.conc.length; i++) {
			if (concentrations.conc[i][1] < params[param]) continue
			if (concentrations.conc[i][0] == params[param]) {
				I = concentrations.aqi[i][0]
				break
			}
			if (concentrations.conc[i][1] == params[param]) {
				I = concentrations.aqi[i][1]
				break
			}

			;(B_HI = concentrations.conc[i][1]),
				(B_LO = concentrations.conc[i][0]),
				(I_HI = concentrations.aqi[i][1]),
				(I_LO = concentrations.aqi[i][0])
			break
		}
		if (I != 0) {
			mx = Math.max(I, mx)
			continue
		}
		// AQI formula
		I = ((I_HI - I_LO) / (B_HI - B_LO)) * (params[param] - B_LO) + I_LO
		mx = Math.max(I, mx)
	}
	return mx
}
