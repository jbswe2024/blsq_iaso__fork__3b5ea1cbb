import moment from 'moment';

// this is the date format used in url params
export const dateFormat = 'DD-MM-YYYY';
/**
 * @param {String} date - date as a string
 */
export const getUrlParamDateObject = date => {
    return moment(date, dateFormat);
};

// this is the date format used in api calls
export const apiDateFormat = 'YYYY-MM-DD HH:MM';

// this is the short date format used in api calls
export const shortApiDateFormat = 'YYYY-MM-DD';

/**
 * @param {Object} date - date as a moment object
 */
export const getApiParamDateTimeString = date => {
    return date.format(apiDateFormat);
};

/**
 * @param {Object} date - date as a moment object
 */
export const getApiParamDateString = date => {
    return date
        ? getUrlParamDateObject(date).format(shortApiDateFormat)
        : undefined;
};

/**
 * @param {String} date - date as string
 */
export const getFromDateString = dateFrom =>
    dateFrom
        ? getApiParamDateTimeString(
              getUrlParamDateObject(dateFrom).startOf('day'),
          )
        : null;
/**
 * @param {String} date - date as string
 */
export const getToDateString = dateTo =>
    dateTo
        ? getApiParamDateTimeString(getUrlParamDateObject(dateTo).endOf('day'))
        : null;

const longDateFormats = {
    fr: {
        LT: 'HH:mm',
        LTS: 'DD/MM/YYYY HH:mm',
        L: 'DD/MM/YYYY',
        LL: 'Do MMMM YYYY',
        LLL: 'Do MMMM YYYY LT',
        LLLL: 'dddd, MMMM Do YYYY LT',
    },
    en: {
        LT: 'h:mm A',
        LTS: 'MM/DD/YYYY HH:mm',
        L: 'MM/DD/YYYY',
        LL: 'MMMM Do YYYY',
        LLL: 'MMMM Do YYYY LT',
        LLLL: 'dddd, MMMM Do YYYY LT',
    },
};

export const setLocale = code => {
    moment.locale(code);
    moment.updateLocale(code, {
        longDateFormat: longDateFormats[code],
        week: {
            dow: 1,
        },
    });
};
