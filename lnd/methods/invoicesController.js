import config from 'config'
import promisifiedCall from '@zap/utils/promisifiedCall'
import pushinvoices from '../push/subscribeinvoice'

/**
 * Attempts to add a new invoice to the invoice database.
 * @param  lnd   [description]
 * @param  memo  [description]
 * @param  value [description]
 * @return     [description]
 */
export function addInvoice(lnd, { memo, value, private: privateInvoice }) {
  return promisifiedCall(lnd, lnd.addInvoice, {
    memo,
    value,
    private: privateInvoice,
    expiry: config.invoices.expire,
  })
}

/**
 * Returns a list of all the invoices currently stored within the database
 * @param  {[type]} lnd [description]
 * @return {[type]}     [description]
 */
export function listInvoices(lnd) {
  return promisifiedCall(lnd, lnd.listInvoices, { num_max_invoices: 1000 })
}

/**
 * @param  {[type]} payreq [description]
 * @return {[type]}        [description]
 */
export function getInvoice(lnd, { pay_req }) {
  return promisifiedCall(lnd, lnd.decodePayReq, { pay_req })
}

/**
 * Attemps to look up an invoice according to its payment hash
 * @param  {[type]} lnd   [description]
 * @param  {[type]} rhash [description]
 * @return {[type]}       [description]
 */
export function lookupInvoice(lnd, { rhash }) {
  return promisifiedCall(lnd, lnd.lookupInvoice, { r_hash: rhash })
}

/**
 * Returns a uni-directional stream (server -> client) for notifying the client of newly added/settled invoices
 * @param  {[type]} lnd   [description]
 * @param  {[type]} event [description]
 * @return {[type]}       [description]
 */
export function subscribeInvoices(lnd, event) {
  return pushinvoices(lnd, event)
}