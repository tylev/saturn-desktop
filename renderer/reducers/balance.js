import { createSelector } from 'reselect'
import Coin, { CoinBig } from '@zap/utils/coin'
import { grpc } from 'workers'
import createReducer from '@zap/utils/createReducer'

// ------------------------------------
// Initial State
// ------------------------------------

const initialState = {
  isBalanceLoading: false,
  walletBalance: null,
  walletBalanceConfirmed: null,
  walletBalanceUnconfirmed: null,
  channelBalance: null,
  channelBalanceConfirmed: null,
  channelBalancePending: null,
  fetchBalanceError: null,
}

// ------------------------------------
// Constants
// ------------------------------------

export const FETCH_BALANCE = 'FETCH_BALANCE'
export const FETCH_BALANCE_SUCCESS = 'FETCH_BALANCE_SUCCESS'
export const FETCH_BALANCE_FAILURE = 'FETCH_BALANCE_FAILURE'

// ------------------------------------
// Actions
// ------------------------------------

/**
 * fetchBalance - Fetch balances.
 *
 * @returns {Function} Thunk
 */
export const fetchBalance = () => async dispatch => {
  try {
    dispatch({ type: FETCH_BALANCE })
    const { walletBalance, channelBalance } = await grpc.services.Lightning.getBalance()
    dispatch({ type: FETCH_BALANCE_SUCCESS, walletBalance, channelBalance })
  } catch (error) {
    dispatch({ type: FETCH_BALANCE_FAILURE, error })
  }
}

// ------------------------------------
// Action Handlers
// ------------------------------------

const ACTION_HANDLERS = {
  [FETCH_BALANCE]: state => {
    state.isBalanceLoading = true
  },
  [FETCH_BALANCE_SUCCESS]: (state, { walletBalance, channelBalance }) => {
    state.isBalanceLoading = false
    state.walletBalance = walletBalance.totalBalance
    state.walletBalanceConfirmed = walletBalance.confirmedBalance
    state.walletBalanceUnconfirmed = walletBalance.unconfirmedBalance
    state.channelBalance = Coin(channelBalance.balance)
      .add(Coin(channelBalance.pendingOpenBalance))
      .toString()
    state.channelBalanceConfirmed = channelBalance.balance
    state.channelBalancePending = channelBalance.pendingOpenBalance
  },
  [FETCH_BALANCE_FAILURE]: (state, { error }) => {
    state.isBalanceLoading = false
    state.fetchBalanceError = error
  },
}

// ------------------------------------
// Selectors
// ------------------------------------

const balanceSelectors = {}
balanceSelectors.channelBalance = state => state.balance.channelBalance
balanceSelectors.channelBalanceConfirmed = state => state.balance.channelBalanceConfirmed
balanceSelectors.channelBalancePending = state => state.balance.channelBalancePending
balanceSelectors.walletBalance = state => state.balance.walletBalance
balanceSelectors.walletBalanceConfirmed = state => state.balance.walletBalanceConfirmed
balanceSelectors.walletBalanceUnconfirmed = state => state.balance.walletBalanceUnconfirmed
balanceSelectors.limboBalance = state => state.channels.pendingChannels.totalLimboBalance

balanceSelectors.totalBalance = createSelector(
  balanceSelectors.channelBalance,
  balanceSelectors.walletBalance,
  balanceSelectors.limboBalance,
  (channelBalance = 0, walletBalance = 0, limboBalance = 0) =>
    CoinBig.sum(channelBalance, walletBalance, limboBalance).toString()
)

export { balanceSelectors }

export default createReducer(initialState, ACTION_HANDLERS)
