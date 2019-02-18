import React from 'react'
import PropTypes from 'prop-types'
import { Box } from 'rebass'
import { animated, Keyframes, Transition } from 'react-spring'
import { FormattedMessage, injectIntl, intlShape } from 'react-intl'
import { decodePayReq, getMinFee, getMaxFee, isOnchain, isLn } from 'lib/utils/crypto'
import { convert } from 'lib/utils/btc'
import { Bar, Form, Message, LightningInvoiceInput, Panel, Text } from 'components/UI'
import { CurrencyFieldGroup, CryptoValue } from 'containers/UI'
import PaySummaryLightning from 'containers/Pay/PaySummaryLightning'
import PaySummaryOnChain from 'containers/Pay/PaySummaryOnChain'
import PayButtons from './PayButtons'
import PayHeader from './PayHeader'
import messages from './messages'

/**
 * Animation to handle showing/hiding the payReq field.
 */
const ShowHidePayReq = Keyframes.Spring({
  small: { height: 48 },
  big: async (next, cancel, ownProps) => {
    ownProps.context.focusPayReqInput()
    await next({ height: 110, immediate: true })
  }
})

/**
 * Animation to handle showing/hiding the form buttons.
 */
const ShowHideButtons = Keyframes.Spring({
  show: { opacity: 1 },
  hide: { opacity: 0 }
})

/**
 * Animation to handle showing/hiding the amount fields.
 */
const ShowHideAmount = Keyframes.Spring({
  show: async (next, cancel, ownProps) => {
    await next({ display: 'block' })
    ownProps.context.focusAmountInput()
    await next({ opacity: 1, height: 'auto' })
  },
  hide: { opacity: 0, height: 0, display: 'none' },
  remove: { opacity: 0, height: 0, display: 'none', immediate: true }
})

/**
 * Payment form (onchain & offchain)
 */
class Pay extends React.Component {
  static propTypes = {
    intl: intlShape.isRequired,
    /** The currently active chain (bitcoin, litecoin etc) */
    chain: PropTypes.string.isRequired,
    /** The currently active chain (mainnet, testnet) */
    network: PropTypes.string.isRequired,
    /** Human readable chain name */
    cryptoName: PropTypes.string.isRequired,
    /** Current channel balance (in satoshis). */
    channelBalance: PropTypes.number.isRequired,
    /** Currently selected cryptocurrency (key). */
    cryptoCurrency: PropTypes.string.isRequired,
    /** Ticker symbol of the currently selected cryptocurrency. */
    cryptoCurrencyTicker: PropTypes.string.isRequired,
    /** Amount value to populate the amountCrypto field with when the form first loads. */
    initialAmountCrypto: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    /** Amount value to populate the amountFiat field with when the form first loads. */
    initialAmountFiat: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    /** Boolean indicating wether the form is being processed. If true, form buttons are disabled. */
    isProcessing: PropTypes.bool,
    /** Current fee information as provided by bitcoinfees.earn.com */
    onchainFees: PropTypes.shape({
      fastestFee: PropTypes.number,
      halfHourFee: PropTypes.number,
      hourFee: PropTypes.number
    }),
    /** Payment request to load into the form. */
    payReq: PropTypes.string,
    /** Routing information */
    routes: PropTypes.array,
    /** Current wallet balance (in satoshis). */
    walletBalance: PropTypes.number.isRequired,

    /** Method to process offChain invoice payments. Called when the form is submitted. */
    payInvoice: PropTypes.func.isRequired,
    /** Set the current payment request. */
    setPayReq: PropTypes.func.isRequired,
    /** Method to process onChain transactions. Called when the form is submitted. */
    sendCoins: PropTypes.func.isRequired,
    /** Method to collect route information for lightning invoices. */
    queryRoutes: PropTypes.func.isRequired
  }

  static defaultProps = {
    payReq: null,
    initialAmountCrypto: null,
    initialAmountFiat: null,
    isProcessing: false,
    onchainFees: {},
    routes: []
  }

  state = {
    currentStep: 'address',
    initialPayReq: null,
    previousStep: null,
    isLn: null,
    isOnchain: null
  }

  amountInput = React.createRef()
  payReqInput = React.createRef()

  componentDidMount() {
    const { payReq, setPayReq } = this.props
    // If we mount with a payReq, set it in the state in order to trigger form submission once the form is loaded..
    // See componentDidUpdate().
    if (payReq) {
      this.setState({ initialPayReq: payReq })

      // Clear payReq now that it has been applied.
      setPayReq(null)
    }
  }

  componentDidUpdate(prevProps, prevState) {
    const { setPayReq, payReq, queryRoutes } = this.props
    const { currentStep, initialPayReq, invoice, isOnchain } = this.state

    // If initialPayReq was been set in the state when the component mounted, reset the form and submit as new.
    if (initialPayReq && initialPayReq !== prevState.initialPayReq) {
      this.formApi.reset()
      this.formApi.setValue('payReq', initialPayReq)
      this.handlePayReqChange()

      // Clear payReq now that it has been applied.
      setPayReq(null)
    }

    // If payReq has changed, reset the form and submit as new.
    if (payReq && payReq !== prevProps.payReq) {
      this.formApi.reset()
      this.formApi.setValue('payReq', payReq)
      this.handlePayReqChange()

      // Clear payReq now that it has been applied.
      setPayReq(null)
    }

    // If we have gone back to the address step, unmark all fields from being touched.
    if (currentStep !== prevState.currentStep) {
      if (currentStep === 'address') {
        Object.keys(this.formApi.getState().touched).forEach(field => {
          this.formApi.setTouched(field, false)
        })
      }
    }

    // If we now have a valid onchain address, trigger the form submit.
    if (isOnchain && isOnchain !== prevState.isOnchain) {
      this.formApi.submitForm()
    }

    // If we now have a valid lightning invoice, call queryRoutes and submit the form.
    if (invoice && invoice !== prevState.invoice) {
      this.formApi.submitForm()
      const { payeeNodeKey } = invoice
      queryRoutes(payeeNodeKey, this.amountInSats())
    }
  }

  amountInSats = () => {
    const { isLn, isOnchain, invoice } = this.state
    const { cryptoCurrency } = this.props
    if (isLn && invoice) {
      const { satoshis, millisatoshis } = invoice
      return (
        satoshis ||
        convert('msats', 'sats', millisatoshis) ||
        convert(cryptoCurrency, 'sats', this.formApi.getValue('amountCrypto'))
      )
    } else if (isOnchain) {
      return convert(cryptoCurrency, 'sats', this.formApi.getValue('amountCrypto'))
    }
  }

  /**
   * Form submit handler.
   * @param  {Object} values submitted form values.
   */
  onSubmit = values => {
    const { currentStep, isOnchain, invoice } = this.state
    const { cryptoCurrency, onchainFees, payInvoice, routes, sendCoins } = this.props
    if (currentStep === 'summary') {
      if (isOnchain) {
        return sendCoins({
          addr: values.payReq,
          value: values.amountCrypto,
          currency: cryptoCurrency,
          satPerByte: onchainFees.fastestFee
        })
      } else {
        return payInvoice({
          payReq: values.payReq,
          value: invoice.satoshis || invoice.millisatoshis ? null : values.amountCrypto,
          currency: cryptoCurrency,
          feeLimit: getMaxFee(routes)
        })
      }
    } else {
      this.nextStep()
    }
  }

  /**
   * Store the formApi on the component context to make it available at this.formApi.
   */
  setFormApi = formApi => {
    this.formApi = formApi
  }

  /**
   * Focus the payReq input.
   */
  focusPayReqInput = () => {
    if (this.payReqInput.current) {
      this.payReqInput.current.focus()
    }
  }

  /**
   * Focus the amount input.
   */
  focusAmountInput = () => {
    if (this.amountInput.current) {
      this.amountInput.current.focus()
    }
  }

  /**
   * List of enabled form steps.
   */
  steps = () => {
    const { isLn, isOnchain, invoice } = this.state
    let steps = ['address']
    if (isLn) {
      // If we have an invoice and the invoice has an amount, this is a 2 step form.
      if (invoice && (invoice.satoshis || invoice.millisatoshis)) {
        steps.push('summary')
      }
      // Othersise, it will be a three step process.
      else {
        steps = ['address', 'amount', 'summary']
      }
    } else if (isOnchain) {
      steps = ['address', 'amount', 'summary']
    }
    return steps
  }

  /**
   * Go back to previous form step.
   */
  previousStep = () => {
    const { currentStep } = this.state
    const nextStep = Math.max(this.steps().indexOf(currentStep) - 1, 0)
    if (currentStep !== nextStep) {
      this.setState({ currentStep: this.steps()[nextStep], previousStep: currentStep })
    }
  }

  /**
   * Progress to next form step.
   */
  nextStep = () => {
    const { currentStep } = this.state
    const nextStep = Math.min(this.steps().indexOf(currentStep) + 1, this.steps().length - 1)
    if (currentStep !== nextStep) {
      this.setState({ currentStep: this.steps()[nextStep], previousStep: currentStep })
    }
  }

  /**
   * Set isLn/isOnchain state based on payReq value.
   */
  handlePayReqChange = () => {
    const { chain, network } = this.props
    const payReq = this.formApi.getValue('payReq')
    const state = {
      currentStep: 'address',
      isLn: null,
      isOnchain: null,
      invoice: null
    }

    // See if the user has entered a valid lightning payment request.
    if (isLn(payReq, chain, network)) {
      let invoice
      try {
        invoice = decodePayReq(payReq)
        state.invoice = invoice
      } catch (e) {
        return
      }
      state.isLn = true
    }

    // Otherwise, see if we have a valid onchain address.
    else if (isOnchain(payReq, chain, network)) {
      state.isOnchain = true
    }

    // Update the state with our findings.
    this.setState(state)
  }

  renderHelpText = () => {
    const { cryptoName, cryptoCurrencyTicker, payReq } = this.props
    const { currentStep, previousStep } = this.state

    // Do not render the help text if the form has just loadad with an initial payment request.
    if (payReq && !previousStep) {
      return null
    }

    return (
      <Transition
        native
        items={currentStep === 'address'}
        from={{ opacity: 0, height: 0 }}
        enter={{ opacity: 1, height: 80 }}
        leave={{ opacity: 0, height: 0 }}
        initial={{ opacity: 1, height: 80 }}
      >
        {show =>
          show &&
          (styles => (
            <animated.div style={styles}>
              <Box mb={4}>
                <Text textAlign="justify">
                  <FormattedMessage
                    {...messages.description}
                    values={{ chain: cryptoName, ticker: cryptoCurrencyTicker }}
                  />
                </Text>
              </Box>
            </animated.div>
          ))
        }
      </Transition>
    )
  }

  renderAddressField = () => {
    const { currentStep, isLn } = this.state
    const { chain, payReq, network, intl } = this.props

    const payReq_label =
      currentStep === 'address'
        ? 'request_label_combined'
        : isLn
        ? 'request_label_offchain'
        : 'request_label_onchain'

    return (
      <Box className={currentStep !== 'summary' ? 'element-show' : 'element-hide'}>
        <ShowHidePayReq state={currentStep === 'address' || isLn ? 'big' : 'small'} context={this}>
          {styles => (
            <React.Fragment>
              <LightningInvoiceInput
                field="payReq"
                name="payReq"
                label={intl.formatMessage({ ...messages[payReq_label] })}
                style={styles}
                initialValue={payReq}
                required
                chain={chain}
                network={network}
                validateOnBlur
                validateOnChange
                onChange={this.handlePayReqChange}
                width={1}
                readOnly={currentStep !== 'address'}
                forwardedRef={this.payReqInput}
                css={{
                  resize: 'vertical',
                  'min-height': '48px'
                }}
              />
            </React.Fragment>
          )}
        </ShowHidePayReq>
      </Box>
    )
  }

  renderAmountFields = () => {
    const { currentStep } = this.state
    const { initialAmountCrypto, initialAmountFiat } = this.props

    return (
      <ShowHideAmount
        state={currentStep === 'amount' ? 'show' : currentStep === 'address' ? 'hide' : 'remove'}
        context={this}
      >
        {styles => (
          <Box style={styles}>
            <Bar my={3} />

            <CurrencyFieldGroup
              disabled={currentStep !== 'amount'}
              forwardedRef={this.amountInput}
              initialAmountCrypto={initialAmountCrypto}
              initialAmountFiat={initialAmountFiat}
              formApi={this.formApi}
            />
          </Box>
        )}
      </ShowHideAmount>
    )
  }

  renderSummary = () => {
    const { currentStep, isOnchain } = this.state
    const { routes } = this.props

    const formState = this.formApi.getState()
    let minFee, maxFee
    if (routes.length) {
      minFee = getMinFee(routes)
      maxFee = getMaxFee(routes)
    }

    const render = () => {
      // convert entered amount to satoshis
      const amount = this.amountInSats()

      if (isOnchain) {
        return <PaySummaryOnChain mt={-3} amount={amount} address={formState.values.payReq} />
      } else if (isLn) {
        return (
          <PaySummaryLightning
            mt={-3}
            minFee={minFee}
            maxFee={maxFee}
            payReq={formState.values.payReq}
            amount={amount}
          />
        )
      }
    }

    return (
      <Transition
        native
        items={currentStep === 'summary'}
        from={{ opacity: 0, height: 0 }}
        enter={{ opacity: 1, height: 'auto' }}
        leave={{ opacity: 0, height: 0 }}
        initial={{ opacity: 1, height: 'auto' }}
      >
        {show => show && (styles => <animated.div style={styles}>{render()}</animated.div>)}
      </Transition>
    )
  }

  /**
   * Form renderer.
   */
  render() {
    const { currentStep, invoice, isLn, isOnchain } = this.state
    const {
      chain,
      network,
      channelBalance,
      cryptoCurrency,
      cryptoCurrencyTicker,
      cryptoName,
      payReq,
      initialAmountCrypto,
      initialAmountFiat,
      isProcessing,
      onchainFees,
      payInvoice,
      sendCoins,
      setPayReq,
      queryRoutes,
      routes,
      walletBalance,
      ...rest
    } = this.props
    return (
      <Form
        width={1}
        css={{ height: '100%' }}
        {...rest}
        getApi={this.setFormApi}
        onSubmit={this.onSubmit}
      >
        {({ formState }) => {
          // Deterine which buttons should be visible.
          const showBack = currentStep !== 'address'
          const showSubmit = currentStep !== 'address' || (isOnchain || isLn)

          // convert entered amount to satoshis
          let amountInSats = this.amountInSats()

          // Determine wether we have enough funds available.
          let hasEnoughFunds = true
          if (isLn && invoice) {
            hasEnoughFunds = amountInSats <= channelBalance
          } else if (isOnchain) {
            hasEnoughFunds = amountInSats <= walletBalance
          }

          // Determine what the text should be for the next button.
          let nextButtonText = <FormattedMessage {...messages.next} />
          if (currentStep === 'summary') {
            nextButtonText = (
              <>
                <FormattedMessage {...messages.send} />
                {` `}
                <CryptoValue value={amountInSats} />
                {` `}
                {cryptoCurrencyTicker}
              </>
            )
          }
          return (
            <Panel>
              <Panel.Header>
                <PayHeader
                  title={
                    <>
                      <FormattedMessage {...messages.send} /> {cryptoName} ({cryptoCurrencyTicker})
                    </>
                  }
                  type={isLn ? 'offchain' : isOnchain ? 'onchain' : null}
                />
                <Bar pt={2} />
              </Panel.Header>

              <Panel.Body py={3}>
                {this.renderHelpText()}
                {this.renderAddressField()}
                {this.renderAmountFields()}
                {this.renderSummary()}
              </Panel.Body>
              <Panel.Footer>
                <ShowHideButtons state={showBack || showSubmit ? 'show' : 'show'}>
                  {styles => (
                    <Box style={styles}>
                      {currentStep === 'summary' && !hasEnoughFunds && (
                        <Message variant="error" justifyContent="center" mb={2}>
                          <FormattedMessage {...messages.error_not_enough_funds} />
                        </Message>
                      )}

                      <PayButtons
                        disabled={
                          formState.pristine ||
                          formState.invalid ||
                          isProcessing ||
                          (currentStep === 'summary' && !hasEnoughFunds)
                        }
                        nextButtonText={nextButtonText}
                        processing={isProcessing}
                        showBack={showBack}
                        showSubmit={showSubmit}
                        previousStep={this.previousStep}
                      />

                      {walletBalance !== null && (
                        <React.Fragment>
                          <Text textAlign="center" mt={3} fontWeight="normal">
                            <FormattedMessage {...messages.current_balance} />:
                          </Text>
                          <Text textAlign="center" fontSize="xs">
                            <CryptoValue value={walletBalance} />
                            {` `}
                            {cryptoCurrencyTicker} (onchain),
                          </Text>
                          <Text textAlign="center" fontSize="xs">
                            <CryptoValue value={channelBalance} />
                            {` `}
                            {cryptoCurrencyTicker} (in channels)
                          </Text>
                        </React.Fragment>
                      )}
                    </Box>
                  )}
                </ShowHideButtons>
              </Panel.Footer>
            </Panel>
          )
        }}
      </Form>
    )
  }
}

export default injectIntl(Pay)
