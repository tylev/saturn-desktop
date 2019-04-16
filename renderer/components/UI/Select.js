import React from 'react'
import PropTypes from 'prop-types'
import { asField } from 'informed'
import { compose } from 'redux'
import { injectIntl, intlShape } from 'react-intl'
import styled, { withTheme } from 'styled-components'
import Downshift from 'downshift'
import { Box, Flex } from 'rebass'
import system from '@rebass/components'
import Check from 'components/Icon/Check'
import AngleUp from 'components/Icon/AngleUp'
import AngleDown from 'components/Icon/AngleDown'
import Text from './Text'
import { BasicInput } from './Input'
import messages from './messages'

const SelectOptionList = styled.ul`
  padding: 0;
  margin-top: 4px;
  position: absolute;
  z-index: 2;
  width: 100%;
  max-height: 20rem;
  overflow-y: auto;
  overflow-x: hidden;
  outline: 0;
  transition: opacity 0.1s ease;
  background-color: ${props => props.theme.colors.secondaryColor};
  border-radius: 5px;
  box-shadow: 0 3px 4px 0 rgba(30, 30, 30, 0.5);
`

const SelectOptionItem = styled(
  system(
    {
      extend: Box,
      as: 'li',
      p: 2,
    },
    'space',
    'color'
  )
)`
  outline: none;
  cursor: pointer;
`

const getIconStyles = props => `
  margin-left: -${props.width + 16}px;
  width: ${props.width}px;
  pointer-events: none;
  color: ${props.color || props.theme.colors.gray};
`

const ArrowIconClosed = styled(AngleDown)`
  ${props => getIconStyles(props)}
`

const ArrowIconOpen = styled(AngleUp)`
  ${props => getIconStyles(props)}
`

const StyledInput = styled(BasicInput)`
  input {
    cursor: pointer;
    color: transparent;
    text-shadow: 0 0 0 ${props => props.color || props.theme.colors.primaryText};
  }
`

const itemToString = item => (item ? item.value : '')

/**
 * @render react
 * @name Select
 */
class Select extends React.PureComponent {
  static displayName = 'Select'

  static propTypes = {
    color: PropTypes.string,
    fieldApi: PropTypes.object.isRequired,
    fieldState: PropTypes.object.isRequired,
    iconSize: PropTypes.number,
    initialSelectedItem: PropTypes.string,
    intl: intlShape.isRequired,
    items: PropTypes.array,
    onValueSelected: PropTypes.func,
    theme: PropTypes.object.isRequired,
  }

  static defaultProps = {
    items: [],
    iconSize: 8,
  }

  inputRef = React.createRef()

  blurInput = () => {
    if (this.inputRef.current) {
      this.inputRef.current.blur()
    }
  }

  renderSelectOptions = (highlightedIndex, selectedItem, getItemProps) => {
    let { items, theme } = this.props

    return items.map((item, index) => (
      <SelectOptionItem
        key={item.key}
        {...getItemProps({
          key: item.key,
          index,
          item,
        })}
        bg={highlightedIndex === index ? theme.colors.primaryColor : null}
        p={2}
      >
        <Flex alignItems="center" pr={2}>
          <Text color="superGreen" textAlign="center" width="20px">
            {selectedItem.key === item.key && <Check height="0.95em" />}
          </Text>
          <Text>{item.value}</Text>
        </Flex>
      </SelectOptionItem>
    ))
  }

  render() {
    let {
      fieldApi,
      fieldState,
      iconSize,
      items,
      theme,
      color,
      onValueSelected,
      initialSelectedItem,
      intl,
      ...rest
    } = this.props
    const { setValue, setTouched } = fieldApi

    let initialInputValue
    if (initialSelectedItem) {
      initialSelectedItem = items.find(i => i.key === initialSelectedItem)
      initialInputValue = itemToString(initialSelectedItem)
    }

    return (
      <Downshift
        initialInputValue={initialInputValue}
        initialSelectedItem={initialSelectedItem}
        itemToString={itemToString}
        // When an item is selected, set the item in the Informed form state.
        onInputValueChange={(inputValue, stateAndHelpers) => {
          if (inputValue && inputValue !== itemToString(stateAndHelpers.selectedItem)) {
            fieldApi.setValue(itemToString(stateAndHelpers.selectedItem))
          }
        }}
        onSelect={item => {
          setValue(item.value)
          setTouched(true)
          if (onValueSelected) {
            onValueSelected(item.key)
          }
          this.blurInput()
        }}
      >
        {({
          getInputProps,
          getItemProps,
          getMenuProps,
          isOpen,
          highlightedIndex,
          selectedItem,
          closeMenu,
          openMenu,
          toggleMenu,
        }) => {
          const getInitialValue = () => {
            if (selectedItem) {
              return selectedItem.value
            }

            if (initialSelectedItem) {
              initialSelectedItem.value
            }

            return ''
          }
          return (
            <div style={{ position: 'relative' }}>
              <Flex alignItems="center">
                <StyledInput
                  placeholder={intl.formatMessage({ ...messages.select_placeholder })}
                  {...rest}
                  initialValue={getInitialValue()}
                  {...getInputProps({
                    onBlur: closeMenu,
                    onFocus: openMenu,
                    onMouseDown: toggleMenu,
                  })}
                  fieldApi={fieldApi}
                  fieldState={fieldState}
                  forwardedRef={this.inputRef}
                />
                <Box>
                  {isOpen ? (
                    <ArrowIconOpen width={iconSize} />
                  ) : (
                    <ArrowIconClosed width={iconSize} />
                  )}
                </Box>
              </Flex>
              {isOpen && (
                <SelectOptionList {...getMenuProps({}, { suppressRefError: true })}>
                  {this.renderSelectOptions(highlightedIndex, selectedItem, getItemProps)}
                </SelectOptionList>
              )}
            </div>
          )
        }}
      </Downshift>
    )
  }
}

const BasicSelect = compose(
  injectIntl,
  withTheme
)(Select)

export { BasicSelect }
export default asField(BasicSelect)