/* eslint-disable camelcase */
import React, { Component } from 'react';
import omit from 'lodash/omit';
import { connect } from 'react-redux';
import { push, replace } from 'react-router-redux';
import { bindActionCreators } from 'redux';

import { withStyles, Box, Tabs, Tab, Grid } from '@material-ui/core';

import PropTypes from 'prop-types';

import {
    createUrl,
    injectIntl,
    commonStyles,
    LoadingSpinner,
} from 'bluesquare-components';
import { alpha } from '@material-ui/core/styles/colorManipulator';
import TopBar from '../../components/nav/TopBarComponent';
import {
    setCurrentOrgUnit,
    setOrgUnitTypes,
    resetOrgUnits,
    setSources,
    setGroups,
    setFetchingDetail,
    saveOrgUnit as saveOrgUnitAction,
    createOrgUnit as createOrgUnitAction,
} from './actions';
import { setAlgorithms, setAlgorithmRuns } from '../links/actions';

import { setForms as setFormsAction } from '../forms/actions';
import formsTableColumns from '../forms/config';

import {
    fetchOrgUnitsTypes,
    fetchAssociatedDataSources,
    fetchOrgUnitDetail,
    fetchForms,
    fetchGroups,
    fetchSources,
    fetchOrgUnitsList,
    fetchLinks,
    fetchAlgorithms,
    fetchAlgorithmRuns,
    saveLink,
    fetchAssociatedOrgUnits,
    deleteForm,
} from '../../utils/requests';
import {
    getAliasesArrayFromString,
    getOrgUnitsTree,
    getLinksSources,
} from './utils';
import { fetchUsersProfiles as fetchUsersProfilesAction } from '../users/actions';

import OrgUnitForm from './components/OrgUnitForm';
import OrgUnitMap from './components/orgUnitMap/OrgUnitMapComponent';
import Logs from '../../components/logs/LogsComponent';
import SingleTable from '../../components/tables/SingleTable';
import LinksDetails from '../links/components/LinksDetailsComponent';

import { getChipColors, getOtChipColors } from '../../constants/chipColors';
import { baseUrls } from '../../constants/urls';
import MESSAGES from './messages';

import {
    orgUnitFiltersWithPrefix,
    linksFiltersWithPrefix,
    onlyChildrenParams,
} from '../../constants/filters';
import { orgUnitsTableColumns } from './config';
import { linksTableColumns } from '../links/config';
import { OrgUnitsMapComments } from './components/orgUnitMap/OrgUnitsMapComments';
import { userHasPermission } from '../users/utils';

const baseUrl = baseUrls.orgUnitDetails;

const styles = theme => ({
    ...commonStyles(theme),
    root: {
        '& path.primary': {
            fill: alpha(theme.palette.primary.main, 0.6),
            stroke: theme.palette.primary.main,
            strokeOpacity: 1,
            strokeWidth: 3,
        },
        '& path.secondary': {
            fill: alpha(theme.palette.secondary.main, 0.6),
            stroke: theme.palette.secondary.main,
            strokeOpacity: 1,
            strokeWidth: 3,
        },
    },
    hiddenOpacity: {
        position: 'absolute',
        top: '0px',
        left: '0px',
        width: '100vw',
        zIndex: '-100',
        opacity: '0',
    },
    comments: {
        overflowY: 'auto',
        height: '65vh',
    },
    commentsWrapper: {
        backgroundColor: 'white',
        paddingTop: '10px',
    },
});

const initialOrgUnit = {
    id: null,
    name: '',
    org_unit_type_id: null,
    groups: [],
    sub_source: null,
    status: false,
    aliases: [],
};

class OrgUnitDetail extends Component {
    constructor(props) {
        super(props);
        this.handleDeleteForm = this.handleDeleteForm.bind(this);
        this.resetSingleTableForceRefresh =
            this.resetSingleTableForceRefresh.bind(this);
        this.state = {
            tab: props.params.tab ? props.params.tab : 'infos',
            currentOrgUnit: undefined,
            orgUnitModified: false,
            orgUnitLocationModified: false,
            sourcesSelected: undefined,
            tableColumns: formsTableColumns({
                formatMessage: props.intl.formatMessage,
                component: this,
                user: this.props.currentUser,
                deleteForm: this.handleDeleteForm,
            }),
            forceSingleTableRefresh: false,
        };
    }

    componentDidMount() {
        const {
            dispatch,
            params: { orgUnitId },
            fetchUsersProfiles,
        } = this.props;

        fetchUsersProfiles();
        fetchAlgorithms(dispatch).then(algoList =>
            this.props.setAlgorithms(algoList),
        );
        fetchAlgorithmRuns(dispatch).then(algoRunsList =>
            this.props.setAlgorithmRuns(algoRunsList),
        );
        fetchGroups(dispatch, orgUnitId === '0').then(groups =>
            this.props.setGroups(groups),
        );

        const promisesArray = [fetchOrgUnitsTypes(dispatch)];
        if (orgUnitId !== '0') {
            promisesArray.push(fetchAssociatedDataSources(dispatch, orgUnitId));
            promisesArray.push(
                fetchLinks(dispatch, `/api/links/?orgUnitId=${orgUnitId}`),
            );
        } else {
            promisesArray.push(fetchSources(dispatch));
        }

        Promise.all(promisesArray).then(
            ([orgUnitTypes, sources, { links } = []]) => {
                this.props.setOrgUnitTypes(
                    orgUnitTypes.map((ot, i) => ({
                        ...ot,
                        color: getOtChipColors(i),
                    })),
                );
                const coloredSources = sources.map((s, i) => ({
                    ...s,
                    color: getChipColors(i),
                }));
                this.props.setSources(coloredSources);
                this.fetchDetail().then(async orgUnit => {
                    const selectedSources = getLinksSources(
                        links,
                        coloredSources,
                        orgUnit,
                    );
                    const fullSelectedSources = [];
                    for (let i = 0; i < selectedSources.length; i += 1) {
                        const ss = selectedSources[i];
                        // eslint-disable-next-line no-await-in-loop
                        const detail = await fetchAssociatedOrgUnits(
                            dispatch,
                            ss,
                            orgUnit,
                        );
                        fullSelectedSources.push(detail);
                    }
                    this.setState({
                        sourcesSelected: fullSelectedSources,
                    });
                    dispatch(setFetchingDetail(false));
                });
            },
        );
    }

    componentDidUpdate(prevProps) {
        const { params } = this.props;
        if (
            params.orgUnitId !== prevProps.params.orgUnitId &&
            prevProps.params.orgUnitId !== '0'
        ) {
            this.resetCurrentOrgUnit();
            this.fetchDetail().then(() => {
                // we need the condition here otherwise the setState from handleChangeTab will trigger before fetching is done
                // Which will cause display errors
                if (params.tab !== prevProps.params.tab) {
                    this.handleChangeTab(params.tab, false);
                }
            });
            // repeating the condition here with else if to handle tab navigation without redirection
        } else if (params.tab !== prevProps.params.tab) {
            this.handleChangeTab(params.tab, false);
        }
    }

    handleChangeTab(tab, redirect = true) {
        if (redirect) {
            const { redirectTo, params } = this.props;
            const newParams = {
                ...params,
                tab,
            };
            redirectTo(baseUrl, newParams);
        }
        this.setState({
            tab,
        });
    }

    handleChangeShape(geoJson, key) {
        const currentOrgUnit = {
            ...this.state.currentOrgUnit,
            [key]: geoJson,
        };
        this.setOrgUnitLocationModified(true);
        this.setState({
            currentOrgUnit,
        });
    }

    handleChangeLocation(location) {
        // TODO not sure why, perhaps to remove decimals
        const convert = pos =>
            pos !== null ? parseFloat(pos.toFixed(8)) : null;
        const newPos = {
            altitude: location.alt ? convert(location.alt) : 0,
        };
        // only update dimensions that are presents
        if (location.lng !== undefined) {
            newPos.longitude = convert(location.lng);
        }
        if (location.lat !== undefined) {
            newPos.latitude = convert(location.lat);
        }

        this.setState({
            orgUnitLocationModified: true,
            currentOrgUnit: {
                ...this.state.currentOrgUnit,
                ...newPos,
            },
        });
    }

    handleSaveOrgUnit(newOrgUnit = {}) {
        const { currentOrgUnit } = this.state;
        let orgUnitPayload = omit({ ...currentOrgUnit, ...newOrgUnit });
        orgUnitPayload = {
            ...orgUnitPayload,
            groups:
                orgUnitPayload.groups.length > 0 && !orgUnitPayload.groups[0].id
                    ? orgUnitPayload.groups
                    : orgUnitPayload.groups.map(g => g.id),
        };
        const { saveOrgUnit, createOrgUnit, redirectTo, params } = this.props;

        const isNewOrgunit = currentOrgUnit && !currentOrgUnit.id;
        const savePromise = isNewOrgunit
            ? createOrgUnit(orgUnitPayload)
            : saveOrgUnit(orgUnitPayload);
        return savePromise
            .then(savedOrgUnit => {
                this.setState({
                    orgUnitLocationModified: false,
                    currentOrgUnit: savedOrgUnit,
                });
                this.props.resetOrgUnits();
                this.props.setCurrentOrgUnit(savedOrgUnit);
                if (isNewOrgunit) {
                    redirectTo(baseUrl, {
                        ...params,
                        orgUnitId: savedOrgUnit.id,
                    });
                }
                return savedOrgUnit;
            })
            .catch(err => {
                throw err;
            });
    }

    async handleResetOrgUnit() {
        const { redirectTo, params, dispatch } = this.props;
        const newParams = {
            ...params,
            levels: null,
        };
        redirectTo(baseUrl, newParams);

        dispatch(setFetchingDetail(true));
        await this.fetchDetail();
        dispatch(setFetchingDetail(false));
    }

    async handleDeleteForm(formId) {
        const { dispatch } = this.props;
        await deleteForm(dispatch, formId);
        this.setState({ forceSingleTableRefresh: true });
    }

    setOrgUnitLocationModified(orgUnitLocationModified = true) {
        this.setState({
            orgUnitLocationModified,
        });
    }

    resetCurrentOrgUnit() {
        this.setState({
            currentOrgUnit: undefined,
        });
    }

    resetSingleTableForceRefresh() {
        this.setState({ forceSingleTableRefresh: false });
    }

    fetchDetail() {
        const {
            params: { orgUnitId },
            dispatch,
        } = this.props;
        if (orgUnitId !== '0') {
            return fetchOrgUnitDetail(dispatch, orgUnitId).then(orgUnit => {
                const orgUnitTree = getOrgUnitsTree(orgUnit);
                if (orgUnitTree.length > 0) {
                    const { redirectTo, params } = this.props;
                    const levels = orgUnitTree.map(o => o.id);
                    const newParams = {
                        ...params,
                        levels,
                    };
                    redirectTo(baseUrl, newParams);
                }
                this.props.setCurrentOrgUnit(orgUnit);

                this.setState({
                    currentOrgUnit: orgUnit,
                });
                return orgUnit;
            });
        }
        this.props.setCurrentOrgUnit(initialOrgUnit);
        this.setState({
            currentOrgUnit: initialOrgUnit,
        });
        return new Promise(resolve => resolve());
    }

    goToRevision(orgUnitRevision) {
        // FIXME: Only send the modified fields and do the merge server side
        const mappedRevision = {
            ...this.props.currentOrgUnit,
            ...orgUnitRevision.fields,
            geo_json: null,
            aliases: orgUnitRevision.fields.aliases
                ? getAliasesArrayFromString(orgUnitRevision.fields.aliases)
                : this.props.currentOrgUnit.aliases,
            id: this.props.currentOrgUnit.id,
        };
        // Retrieve only the group ids as it's what the API expect
        const group_ids = mappedRevision.groups.map(g => g.id);
        mappedRevision.groups = group_ids;
        const { saveOrgUnit } = this.props;
        return saveOrgUnit(mappedRevision).then(currentOrgUnit => {
            this.setState({
                currentOrgUnit,
            });
            this.props.resetOrgUnits();
            this.props.setCurrentOrgUnit(currentOrgUnit);
        });
    }

    validateLink(link, handleFetch) {
        const { dispatch } = this.props;
        const newLink = {
            ...link,
            validated: !link.validated,
        };
        saveLink(dispatch, newLink).then(() => handleFetch());
    }

    render() {
        const {
            classes,
            fetching,
            intl: { formatMessage },
            orgUnitTypes,
            groups,
            params,
            router,
            prevPathname,
            redirectToPush,
            reduxPage,
            sources,
            profiles,
            algorithms,
            algorithmRuns,
        } = this.props;
        const {
            tab,
            currentOrgUnit,
            orgUnitModified,
            orgUnitLocationModified,
            sourcesSelected,
        } = this.state;
        const isNewOrgunit = params.orgUnitId === '0';
        let title = '';
        if (currentOrgUnit) {
            title = !isNewOrgunit
                ? currentOrgUnit.name
                : formatMessage(MESSAGES.newOrgUnit);
            if (!isNewOrgunit) {
                title = `${title}${
                    currentOrgUnit.org_unit_type_name
                        ? ` - ${currentOrgUnit.org_unit_type_name}`
                        : ''
                }`;
            }
        }
        const allTabs = [
            'infos',
            'map',
            'children',
            'links',
            'history',
            'forms',
            'comments',
        ];

        const tabs = userHasPermission('iaso_forms', this.props.currentUser)
            ? allTabs
            : allTabs.filter(t => t !== 'forms');
        return (
            <section className={classes.root}>
                <TopBar
                    title={title}
                    displayBackButton
                    goBack={() => {
                        if (prevPathname) {
                            setTimeout(() => {
                                router.goBack();
                            }, 300);
                        } else {
                            redirectToPush(baseUrls.orgUnits, {});
                        }
                    }}
                >
                    {!isNewOrgunit && (
                        <Tabs
                            value={tab}
                            classes={{
                                root: classes.tabs,
                                indicator: classes.indicator,
                            }}
                            onChange={(event, newtab) =>
                                this.handleChangeTab(newtab)
                            }
                        >
                            {tabs.map(t => (
                                <Tab
                                    key={t}
                                    value={t}
                                    label={formatMessage(MESSAGES[t])}
                                />
                            ))}
                        </Tabs>
                    )}
                </TopBar>
                {fetching && <LoadingSpinner />}
                {currentOrgUnit && (
                    <section>
                        {tab === 'infos' && (
                            <Box
                                className={
                                    isNewOrgunit
                                        ? classes.containerFullHeightNoTabPadded
                                        : classes.containerFullHeightPadded
                                }
                            >
                                <OrgUnitForm
                                    orgUnit={currentOrgUnit}
                                    orgUnitTypes={orgUnitTypes}
                                    groups={groups}
                                    onResetOrgUnit={() =>
                                        this.handleResetOrgUnit()
                                    }
                                    saveOrgUnit={newOrgUnit =>
                                        this.handleSaveOrgUnit(newOrgUnit)
                                    }
                                    params={params}
                                    baseUrl={baseUrl}
                                    orgUnitModified={orgUnitModified}
                                />
                            </Box>
                        )}
                        <div
                            className={
                                tab === 'map' ? '' : classes.hiddenOpacity
                            }
                        >
                            <Box className={classes.containerFullHeight}>
                                <OrgUnitMap
                                    sourcesSelected={sourcesSelected}
                                    setSourcesSelected={newSourcesSelected => {
                                        this.setState({
                                            sourcesSelected: newSourcesSelected,
                                        });
                                    }}
                                    setOrgUnitLocationModified={isModified =>
                                        this.setOrgUnitLocationModified(
                                            isModified,
                                        )
                                    }
                                    orgUnitLocationModified={
                                        orgUnitLocationModified
                                    }
                                    orgUnit={currentOrgUnit}
                                    resetOrgUnit={() =>
                                        this.handleResetOrgUnit()
                                    }
                                    saveOrgUnit={() => this.handleSaveOrgUnit()}
                                    onChangeLocation={location => {
                                        this.handleChangeLocation(location);
                                    }}
                                    onChangeShape={(key, geoJson) =>
                                        this.handleChangeShape(geoJson, key)
                                    }
                                />
                            </Box>
                        </div>

                        {tab === 'history' && (
                            <Logs
                                params={params}
                                logObjectId={currentOrgUnit.id}
                                goToRevision={orgUnitRevision =>
                                    this.goToRevision(orgUnitRevision)
                                }
                            />
                        )}
                        {tab === 'forms' && (
                            <SingleTable
                                paramsPrefix="formsParams"
                                apiParams={{
                                    orgUnitId: currentOrgUnit.id,
                                }}
                                exportButton={false}
                                baseUrl={baseUrl}
                                endPointPath="forms"
                                propsToWatch={params.tab}
                                fetchItems={fetchForms}
                                columns={this.state.tableColumns}
                                results={reduxPage}
                                onDataLoaded={({ list, count, pages }) => {
                                    this.props.setForms(
                                        list,
                                        true,
                                        params,
                                        count,
                                        pages,
                                    );
                                }}
                                forceRefresh={
                                    this.state.forceSingleTableRefresh
                                }
                                onForceRefreshDone={() =>
                                    this.resetSingleTableForceRefresh()
                                }
                            />
                        )}
                        <div
                            className={
                                tab === 'children' ? '' : classes.hiddenOpacity
                            }
                        >
                            <SingleTable
                                paramsPrefix="childrenParams"
                                apiParams={{
                                    ...onlyChildrenParams(
                                        'childrenParams',
                                        params,
                                        params.orgUnitId,
                                    ),
                                }}
                                propsToWatch={params.tab}
                                baseUrl={baseUrl}
                                endPointPath="orgunits"
                                fetchItems={fetchOrgUnitsList}
                                filters={orgUnitFiltersWithPrefix(
                                    'childrenParams',
                                    true,
                                    formatMessage,
                                    groups,
                                    orgUnitTypes,
                                )}
                                columns={orgUnitsTableColumns(
                                    formatMessage,
                                    classes,
                                )}
                            />
                        </div>
                        <div
                            className={
                                tab === 'links' ? '' : classes.hiddenOpacity
                            }
                        >
                            <SingleTable
                                apiParams={{
                                    orgUnitId: currentOrgUnit.id,
                                }}
                                propsToWatch={params.tab}
                                filters={linksFiltersWithPrefix(
                                    'linksParams',
                                    algorithmRuns,
                                    formatMessage,
                                    profiles,
                                    algorithms,
                                    sources,
                                )}
                                paramsPrefix="linksParams"
                                baseUrl={baseUrl}
                                endPointPath="links"
                                fetchItems={fetchLinks}
                                defaultSorted={[
                                    { id: 'similarity_score', desc: false },
                                ]}
                                columns={handleFetch =>
                                    linksTableColumns(formatMessage, link =>
                                        this.validateLink(link, handleFetch),
                                    )
                                }
                                subComponent={(link, handleFetch) =>
                                    link ? (
                                        <LinksDetails
                                            linkId={link.id}
                                            validated={link.validated}
                                            validateLink={() =>
                                                this.validateLink(
                                                    link,
                                                    handleFetch,
                                                )
                                            }
                                        />
                                    ) : null
                                }
                            />
                        </div>
                        {tab === 'comments' && (
                            <Grid
                                container
                                justifyContent="center"
                                className={classes.commentsWrapper}
                            >
                                <Grid item xs={6}>
                                    <OrgUnitsMapComments
                                        className={classes.comments}
                                        orgUnit={currentOrgUnit}
                                        maxPages={4}
                                    />
                                </Grid>
                            </Grid>
                        )}
                    </section>
                )}
            </section>
        );
    }
}
OrgUnitDetail.defaultProps = {
    currentOrgUnit: undefined,
    sources: [],
    prevPathname: null,
    reduxPage: undefined,
};

OrgUnitDetail.propTypes = {
    router: PropTypes.object.isRequired,
    classes: PropTypes.object.isRequired,
    intl: PropTypes.object.isRequired,
    params: PropTypes.object.isRequired,
    setCurrentOrgUnit: PropTypes.func.isRequired,
    setOrgUnitTypes: PropTypes.func.isRequired,
    currentOrgUnit: PropTypes.object,
    redirectTo: PropTypes.func.isRequired,
    redirectToPush: PropTypes.func.isRequired,
    fetching: PropTypes.bool.isRequired,
    orgUnitTypes: PropTypes.array.isRequired,
    dispatch: PropTypes.func.isRequired,
    resetOrgUnits: PropTypes.func.isRequired,
    setSources: PropTypes.func.isRequired,
    sources: PropTypes.array,
    prevPathname: PropTypes.any,
    groups: PropTypes.array.isRequired,
    setGroups: PropTypes.func.isRequired,
    saveOrgUnit: PropTypes.func.isRequired,
    createOrgUnit: PropTypes.func.isRequired,
    setAlgorithms: PropTypes.func.isRequired,
    setAlgorithmRuns: PropTypes.func.isRequired,
    setForms: PropTypes.func.isRequired,
    reduxPage: PropTypes.object,
    profiles: PropTypes.array.isRequired,
    algorithms: PropTypes.array.isRequired,
    algorithmRuns: PropTypes.array.isRequired,
    fetchUsersProfiles: PropTypes.func.isRequired,
    currentUser: PropTypes.object.isRequired,
};

const MapStateToProps = state => ({
    fetching: state.orgUnits.fetchingDetail,
    currentOrgUnit: state.orgUnits.current,
    orgUnitTypes: state.orgUnits.orgUnitTypes,
    sources: state.orgUnits.sources,
    prevPathname: state.routerCustom.prevPathname,
    groups: state.orgUnits.groups,
    profiles: state.users.list,
    algorithms: state.links.algorithmsList,
    algorithmRuns: state.links.algorithmRunsList,
    currentUser: state.users.current,
});

const MapDispatchToProps = dispatch => ({
    dispatch,
    setCurrentOrgUnit: orgUnit => dispatch(setCurrentOrgUnit(orgUnit)),
    setOrgUnitTypes: orgUnitTypes => dispatch(setOrgUnitTypes(orgUnitTypes)),
    redirectTo: (key, params) =>
        dispatch(replace(`${key}${createUrl(params, '')}`)),
    redirectToPush: (key, params) =>
        dispatch(push(`${key}${createUrl(params, '')}`)),
    resetOrgUnits: () => dispatch(resetOrgUnits()),
    setSources: sources => dispatch(setSources(sources)),
    setGroups: groups => dispatch(setGroups(groups)),
    setAlgorithms: algoList => dispatch(setAlgorithms(algoList)),
    setAlgorithmRuns: algoRunsList => dispatch(setAlgorithmRuns(algoRunsList)),
    ...bindActionCreators(
        {
            setForms: setFormsAction,
            saveOrgUnit: saveOrgUnitAction,
            createOrgUnit: createOrgUnitAction,
            fetchUsersProfiles: fetchUsersProfilesAction,
        },
        dispatch,
    ),
});

export default withStyles(styles)(
    connect(MapStateToProps, MapDispatchToProps)(injectIntl(OrgUnitDetail)),
);
