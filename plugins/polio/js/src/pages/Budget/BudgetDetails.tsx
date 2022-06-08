import React, { FunctionComponent, useState } from 'react';
import {
    // @ts-ignore
    useSafeIntl,
    // @ts-ignore
    useSkipEffectOnMount,
} from 'bluesquare-components';
import { Box, Divider, Grid, Paper } from '@material-ui/core';
import { useDispatch, useSelector } from 'react-redux';
import TopBar from '../../../../../../hat/assets/js/apps/Iaso/components/nav/TopBarComponent';
import MESSAGES from '../../constants/messages';
import { convertObjectToString } from '../../utils';
import { useStyles } from '../../styles/theme';
import { TableWithDeepLink } from '../../../../../../hat/assets/js/apps/Iaso/components/tables/TableWithDeepLink';
import { useGetBudgetDetails } from '../../hooks/useGetBudgetDetails';
import { BUDGET, BUDGET_DETAILS } from '../../constants/routes';
import { useBudgetDetailsColumns } from './config';
import { useGetTeams } from '../../hooks/useGetTeams';
import { useGetProfiles } from '../../components/CountryNotificationsConfig/requests';
import { GraphTitle } from '../../components/LQAS-IM/GraphTitle';
import { BudgetStatus } from './BudgetStatus';
import { CreateBudgetEvent } from './CreateBudgetEvent';
import { redirectToReplace } from '../../../../../../hat/assets/js/apps/Iaso/routing/actions';

type Props = {
    router: any;
};

export const BudgetDetails: FunctionComponent<Props> = ({ router }) => {
    const { params } = router;
    const classes = useStyles();
    const { campaignName, campaignId, ...apiParams } = router.params;
    const { formatMessage } = useSafeIntl();
    // @ts-ignore
    const prevPathname = useSelector(state => state.routerCustom.prevPathname);
    const dispatch = useDispatch();

    const { data: budgetDetails, isFetching } = useGetBudgetDetails({
        ...apiParams,
        campaign_id: campaignId,
    });
    // TODO make hook for table specific state and effects
    const [resetPageToOne, setResetPageToOne] = useState('');

    useSkipEffectOnMount(() => {
        const newParams = {
            ...params,
        };
        delete newParams.page;
        delete newParams.order;
        setResetPageToOne(convertObjectToString(newParams));
    }, [params.pageSize, campaignId, campaignName]);

    const { data: teams, isFetching: isFetchingTeams } = useGetTeams();
    const { data: profiles, isFetching: isFetchingProfiles } = useGetProfiles();
    const columns = useBudgetDetailsColumns({ teams, profiles });

    return (
        <>
            <TopBar
                title={formatMessage(MESSAGES.budgetDetails, { campaignName })}
                displayBackButton
                goBack={() => {
                    if (prevPathname) {
                        router.goBack();
                    } else {
                        dispatch(redirectToReplace(BUDGET, {}));
                    }
                }}
            />
            {/* @ts-ignore */}
            <Box className={classes.containerFullHeightNoTabPadded}>
                <Box mb={4} ml={2} mr={2}>
                    <Grid container justifyContent="space-between">
                        <Grid container item xs={6}>
                            {!isFetching && (
                                <BudgetStatus budgetDetails={budgetDetails} />
                            )}
                        </Grid>
                        <Grid>
                            <CreateBudgetEvent campaignId={campaignId} />
                        </Grid>
                    </Grid>
                </Box>
                <Paper elevation={2}>
                    <Box ml={2} pt={2} mr={2}>
                        <GraphTitle
                            text={formatMessage(MESSAGES.steps)}
                            displayTrigger
                        />
                        <Box mt={2} mb={1}>
                            <Divider />
                        </Box>
                        <TableWithDeepLink
                            data={budgetDetails?.results ?? []}
                            count={budgetDetails?.count}
                            pages={budgetDetails?.pages}
                            params={params}
                            columns={columns}
                            baseUrl={BUDGET_DETAILS}
                            marginTop={false}
                            extraProps={{
                                loading:
                                    isFetching ||
                                    isFetchingProfiles ||
                                    isFetchingTeams,
                            }}
                            resetPageToOne={resetPageToOne}
                            elevation={0}
                        />
                    </Box>
                </Paper>
            </Box>
        </>
    );
};
