sap.ui.define([

    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
    "sap/ui/model/Sorter",
    "sap/ui/core/routing/HashChanger",
    "../js/TableFilter",
    "../js/TableValueHelp"
  ], function (Controller, JSONModel, MessageBox, Filter, FilterOperator, Sorter, HashChanger, TableFilter, TableValueHelp) {
  
    "use strict";

    var _this;
    var _aTable = [];
    var _sSbu = "";

    var _sapDateFormat = sap.ui.core.format.DateFormat.getDateInstance({pattern : "yyyy-MM-dd" });
    var _sapDateFormatPH = sap.ui.core.format.DateFormat.getDateInstance({pattern : "MM/dd/yyyy" });
    var _sapDateTimeFormat = sap.ui.core.format.DateFormat.getDateInstance({pattern : "MM/dd/yyyy HH24:MI:SS" });
    var _sapTimeFormat = sap.ui.core.format.DateFormat.getTimeInstance({pattern: "KK:mm:ss a"});
   
    return Controller.extend("zuiporel.controller.BaseController", {

        onInitBase(pThis, pSbu) {
            _this = pThis;
            _sSbu = pSbu;

            this._aColumns = {};
            this._colFilters = {};
            this._aFilterableColumns = {};
            this._aSortableColumns = {};
            this._aInvalidValueState = [];

            this.getView().setModel(new JSONModel({}), "base");

            this.getColumnProp();
            this._tableFilter = TableFilter;
            this._tableValueHelp = TableValueHelp;
        },

        getAppAction: async function() {
            if (sap.ushell.Container !== undefined) {
                const fullHash = new HashChanger().getHash();
                const urlParsing = await sap.ushell.Container.getServiceAsync("URLParsing");
                const shellHash = urlParsing.parseShellHash(fullHash);
                const sAction = shellHash.action;
                var bAppChange;

                if (sAction == "display") bAppChange = false;
                else bAppChange = true;
            } else {
                bAppChange = true;
            }

            _this.getView().getModel("base").setProperty("/appChange", bAppChange);
        },
   
        getColumns(pTableList) {
            _aTable = pTableList;

            pTableList.forEach(item => {
                setTimeout(() => {
                    _this.getDynamicColumns(item);
                }, 100);
            });
        },

        getColumnProp: async function() {
            var sPath = jQuery.sap.getModulePath("zuiporel", "/model/columns.json");

            var oModelColumns = new JSONModel();
            await oModelColumns.loadData(sPath);

            _this._oModelColumns = oModelColumns.getData();
        },

        getDynamicColumns: async function(pTable) {
            var modCode = pTable.modCode;
            var tblSrc = pTable.tblSrc;
            var tblId = pTable.tblId;
            var tblModel = pTable.tblModel;

            var oJSONColumnsModel = new JSONModel();
            var oModel = this.getOwnerComponent().getModel("ZGW_3DERP_COMMON_SRV");
            oModel.setHeaders({
                sbu: _sSbu,
                type: modCode,
                tabname: tblSrc
            });

            return new Promise((resolve, reject) => {
                oModel.read("/ColumnsSet", {
                    success: function (oData, oResponse) {
                        oJSONColumnsModel.setData(oData);
                        console.log("ColumnsSet", oData)
                        if (oData.results.length > 0) {
                            oData.results.forEach(col => {
                                if (col.ColumnName == "COMPLETE")
                                col.DataType =  "BOOLEAN";
                            })
                            
                            _this._aColumns[tblModel] = _this.setTableColumns(tblId, tblModel, oData.results)["columns"];
                            _this.setRowReadMode(tblModel);
                            _this.getView().getModel("base").setProperty("/dataMode", "INIT");
                            
                            var tblProps = {
                                aColumns: _this._aColumns[tblModel]
                            };
                            _this.onAfterTableRender(tblId, tblProps);
                            resolve();
                        }
                    },
                    error: function (err) {
                        _this.closeLoadingDialog();
                        resolve();
                    }
                });
            })
        },

        setTableColumns: function(pTable, pModel, pColumn) {
            var oModel = new JSONModel();
            oModel.setData({
                columns: pColumn,
                rows: []
            });

            var oTable = _this.getView().byId(pTable);
            oTable.setModel(oModel);

            oTable.bindColumns("/columns", function (index, context) {
                var sColumnId = context.getObject().ColumnName;
                var sColumnLabel = context.getObject().ColumnLabel;
                var sColumnType = context.getObject().DataType;
                var sColumnVisible = context.getObject().Visible;
                var sColumnSorted = context.getObject().Sorted;
                var sColumnSortOrder = context.getObject().SortOrder;
                var sColumnWidth = context.getObject().ColumnWidth;
                
                if (sColumnType === "NUMBER") {
                    return new sap.ui.table.Column({
                        id: pModel + "-" + sColumnId,
                        label: new sap.m.Text({text: sColumnLabel}),
                        template: new sap.m.Text({ text: "{" + sColumnId + "}", wrapping: false }),
                        width: sColumnWidth + "px",
                        hAlign: "End",
                        sortProperty: sColumnId,
                        filterProperty: sColumnId,
                        autoResizable: true,
                        visible: sColumnVisible,
                        sorted: sColumnSorted,
                        sortOrder: ((sColumnSorted === true) ? sColumnSortOrder : "Ascending")
                    });
                } else if (sColumnType === "BOOLEAN") {
                    return new sap.ui.table.Column({
                        id: pModel + "-" + sColumnId,
                        label: new sap.m.Text({text: sColumnLabel}),
                        template: new sap.m.CheckBox({
                            selected: "{" + sColumnId + "}",
                            editable: false
                        }),
                        width: sColumnWidth + "px",
                        hAlign: "Center",
                        sortProperty: sColumnId,
                        filterProperty: sColumnId,
                        autoResizable: true,
                        visible: sColumnVisible,
                        sorted: sColumnSorted,
                        sortOrder: ((sColumnSorted === true) ? sColumnSortOrder : "Ascending")
                    });
                } else {
                    return new sap.ui.table.Column({
                        id: pModel + "-" + sColumnId,
                        label: new sap.m.Text({text: sColumnLabel}),
                        template: _this.columnTemplate(sColumnId),
                        width: sColumnWidth + "px",
                        hAlign: "Left",
                        sortProperty: sColumnId,
                        filterProperty: sColumnId,
                        autoResizable: true,
                        visible: sColumnVisible,
                        sorted: sColumnSorted,
                        sortOrder: ((sColumnSorted === true) ? sColumnSortOrder : "Ascending")
                    });
                }
            });

            //date/number sorting
            oTable.attachSort(function(oEvent) {
                var sPath = oEvent.getParameter("column").getSortProperty();
                var bDescending = false;
                
                oTable.getColumns().forEach(col => {
                    if (col.getSorted()) {
                        col.setSorted(false);
                    }
                })
                
                oEvent.getParameter("column").setSorted(true); //sort icon initiator

                if (oEvent.getParameter("sortOrder") === "Descending") {
                    bDescending = true;
                    oEvent.getParameter("column").setSortOrder("Descending") //sort icon Descending
                }
                else {
                    oEvent.getParameter("column").setSortOrder("Ascending") //sort icon Ascending
                }

                var oSorter = new sap.ui.model.Sorter(sPath, bDescending ); //sorter(columnData, If Ascending(false) or Descending(True))
                var oColumn = pColumn.filter(fItem => fItem.ColumnName === oEvent.getParameter("column").getProperty("sortProperty"));
                var columnType = oColumn[0].DataType;

                if (columnType === "DATETIME") {
                    oSorter.fnCompare = function(a, b) {
                        // parse to Date object
                        var aDate = new Date(a);
                        var bDate = new Date(b);

                        if (bDate === null) { return -1; }
                        if (aDate === null) { return 1; }
                        if (aDate < bDate) { return -1; }
                        if (aDate > bDate) { return 1; }

                        return 0;
                    };
                }
                else if (columnType === "NUMBER") {
                    oSorter.fnCompare = function(a, b) {
                        // parse to Date object
                        var aNumber = +a;
                        var bNumber = +b;

                        if (bNumber === null) { return -1; }
                        if (aNumber === null) { return 1; }
                        if (aNumber < bNumber) { return -1; }
                        if (aNumber > bNumber) { return 1; }

                        return 0;
                    };
                }
                
                oTable.getBinding('rows').sort(oSorter);
                // prevent internal sorting by table
                oEvent.preventDefault();
            });

            TableFilter.updateColumnMenu(pTable, this);

            // Add Column Local Props
            pColumn.forEach(item => {
                if (_this._oModelColumns[pModel] && _this._oModelColumns[pModel].filter(x => x.ColumnName == item.ColumnName).length > 0) {
                    item.ValueHelp = _this._oModelColumns[pModel][0].ValueHelp;
                }
                else {
                    item.ValueHelp = { "show": false };
                }
            })

            return {
                columns: pColumn
            }
        },

        columnTemplate: function (sColumnId) {
            var oColumnTemplate;

            oColumnTemplate = new sap.m.Text({ 
                text: "{" + sColumnId + "}", 
                wrapping: false,
                tooltip: "{" + sColumnId + "}"
            }); //default text

            return oColumnTemplate;
        },

        setRowReadMode(pModel) {
            if (!_this._aColumns[pModel]) return;

            var oTable = this.byId(pModel + "Tab");
            var sColName = "";

            oTable.getColumns().forEach((col, idx) => {
                if (col.mAggregations.template.mBindingInfos.text !== undefined) {
                    sColName = col.mAggregations.template.mBindingInfos.text.parts[0].path;
                }
                else if (col.mAggregations.template.mBindingInfos.selected !== undefined) {
                    sColName = col.mAggregations.template.mBindingInfos.selected.parts[0].path;
                }
                else if (col.mAggregations.template.mBindingInfos.value !== undefined) {
                    sColName = col.mAggregations.template.mBindingInfos.value.parts[0].path;
                }

                _this._aColumns[pModel].filter(item => item.ColumnName === sColName)
                    .forEach(ci => {
                        if (ci.DataType === "STRING" || ci.DataType === "DATETIME" || ci.DataType === "NUMBER") {
                            col.setTemplate(new sap.m.Text({
                                text: "{" + pModel + ">" + sColName + "}",
                                wrapping: false
                            }));
                        }
                        else if (ci.DataType === "BOOLEAN") {
                            col.setTemplate(new sap.m.CheckBox({
                                selected: "{" + pModel + ">" + sColName + "}",
                            }));
                        }
                    })
            })

            if (_this.getView().getModel(pModel) != undefined) {
                oTable.getModel().setProperty("/rows", _this.getView().getModel(pModel).getData().results);
            }
            
            TableFilter.applyColFilters(_this);

            _this.getView().getModel("base").setProperty("/dataMode", "READ");
        },

        setRowCreateMode(pModel) {
            var oTable = this.byId(pModel + "Tab");
            oTable.clearSelection();

            oTable.getColumns().forEach((col, idx) => {
                var sColName = "";

                if (col.mAggregations.template.mBindingInfos.text !== undefined) {
                    sColName = col.mAggregations.template.mBindingInfos.text.parts[0].path;
                }
                else if (col.mAggregations.template.mBindingInfos.selected !== undefined) {
                    sColName = col.mAggregations.template.mBindingInfos.selected.parts[0].path;
                }
                else if (col.mAggregations.template.mBindingInfos.value !== undefined) {
                    sColName = col.mAggregations.template.mBindingInfos.value.parts[0].path;
                }
                
                var oNewRow = {};
                _this._aColumns[pModel].filter(item => item.ColumnName === sColName)
                    .forEach(ci => {
                        if (ci.Creatable) {
                            if (ci.ValueHelp["show"]) {
                                var bValueFormatter = false;
                                var sSuggestItemText = ci.ValueHelp["SuggestionItems"].text;
                                var sSuggestItemAddtlText = ci.ValueHelp["SuggestionItems"].additionalText !== undefined ? ci.ValueHelp["SuggestionItems"].additionalText : '';                                    
                                var sTextFormatMode = "Key";

                                if (ci.TextFormatMode && ci.TextFormatMode !== "" && ci.TextFormatMode !== "Key" && ci.ValueHelp["items"].value !== ci.ValueHelp["items"].text) {
                                    sTextFormatMode = ci.TextFormatMode;
                                    bValueFormatter = true;

                                    if (ci.ValueHelp["SuggestionItems"].additionalText && ci.ValueHelp["SuggestionItems"].text !== ci.ValueHelp["SuggestionItems"].additionalText) {
                                        if (sTextFormatMode === "ValueKey" || sTextFormatMode === "Value") {
                                            sSuggestItemText = ci.ValueHelp["SuggestionItems"].additionalText;
                                            sSuggestItemAddtlText = ci.ValueHelp["SuggestionItems"].text;
                                        }
                                    }
                                }
                                
                                var oInput = new sap.m.Input({
                                    type: "Text",
                                    showValueHelp: true,
                                    valueHelpRequest: TableValueHelp.handleTableValueHelp.bind(this),
                                    showSuggestion: true,
                                    maxSuggestionWidth: ci.ValueHelp["SuggestionItems"].additionalText !== undefined ? ci.ValueHelp["SuggestionItems"].maxSuggestionWidth : "1px",
                                    suggestionItems: {
                                        path: ci.ValueHelp["SuggestionItems"].path,
                                        length: 10000,
                                        template: new sap.ui.core.ListItem({
                                            key: ci.ValueHelp["SuggestionItems"].text,
                                            text: sSuggestItemText,
                                            additionalText: sSuggestItemAddtlText,
                                        }),
                                        templateShareable: false
                                    },
                                    change: this.onValueHelpInputChange.bind(this)
                                })

                                if (bValueFormatter) {
                                    oInput.setProperty("textFormatMode", sTextFormatMode)

                                    oInput.bindValue({  
                                        parts: [{ path: pModel + ">" + sColName }, { value: ci.ValueHelp["items"].path }, { value: ci.ValueHelp["items"].value }, { value: ci.ValueHelp["items"].text }, { value: sTextFormatMode }],
                                        formatter: this.formatValueHelp.bind(this)
                                    });
                                }
                                else {
                                    oInput.bindValue({  
                                        parts: [  
                                            { path: pModel + ">" + sColName }
                                        ]
                                    });
                                }

                                col.setTemplate(oInput);
                            }
                            else if (ci.DataType === "BOOLEAN") {
                                col.setTemplate(new sap.m.CheckBox({selected: "{" + pModel + ">" + sColName + "}",  
                                    editable: true
                                }));
                            }
                            else if (ci.DataType === "NUMBER") {
                                col.setTemplate(new sap.m.Input({
                                    type: sap.m.InputType.Number,
                                    textAlign: sap.ui.core.TextAlign.Right,
                                    // value: "{" + pModel + ">" + sColName + "}",
                                    value: "{path:'" + pModel + ">" + sColName + "', formatOptions:{ minFractionDigits:" + ci.Decimal + ", maxFractionDigits:" + ci.Decimal + " }, constraints:{ precision:" + ci.Length + ", scale:" + ci.Decimal + " }}",
                                    liveChange: this.onNumberLiveChange.bind(this), 
                                    enabled: true
                                }));
                            }
                            else if (ci.DataType === "DATE") {
                                col.setTemplate(new sap.m.DatePicker({
                                    value: "{" + pModel + ">" + sColName + "}",
                                    displayFormat: "MM/dd/yyyy",
                                    valueFormat: "MM/dd/yyyy",
                                    change: this.onDateChange.bind(this),
                                    navigate: this.onClickDate.bind(this)
                                }))
                            }
                            else {
                                col.setTemplate(new sap.m.Input({
                                    value: "{" + pModel + ">" + sColName + "}",
                                    liveChange: this.onInputLiveChange.bind(this)
                                }));
                            }
                        }

                        if (ci.Mandatory) {
                            col.getLabel().addStyleClass("sapMLabelRequired");
                        }

                        if (ci.DataType === "STRING") oNewRow[ci.name] = "";
                        //else if (ci.DataType === "NUMBER") oNewRow[ci.name] = "0";
                        else if (ci.DataType === "BOOLEAN") oNewRow[ci.name] = false;
                    })                
            })

            oNewRow["NEW"] = true;

            var aNewRows = this.getView().getModel(pModel).getData().results.filter(item => item.NEW === true);
            aNewRows.push(oNewRow);
            this.getView().getModel(pModel).setProperty("/results", aNewRows);
            
            // Remove filter
            // Search filter
            this.byId(pModel + "Tab").getBinding("rows").filter(null, "Application");
            // Column filter
            this.clearSortFilter(pModel + "Tab");

            _this.getView().getModel("base").setProperty("/dataMode", "NEW");
        },

        setRowEditMode(pModel) {
            var oTable = _this.byId(pModel + "Tab");

            var oInputEventDelegate = {
                onkeydown: function(oEvent){
                    _this.onInputKeyDown(oEvent);
                },
            };
            
            oTable.getColumns().forEach((col, idx) => {
                var sColName = "";

                if (col.mAggregations.template.mBindingInfos.text !== undefined) {
                    sColName = col.mAggregations.template.mBindingInfos.text.parts[0].path;
                }
                else if (col.mAggregations.template.mBindingInfos.selected !== undefined) {
                    sColName = col.mAggregations.template.mBindingInfos.selected.parts[0].path;
                }
                else if (col.mAggregations.template.mBindingInfos.value !== undefined) {
                    sColName = col.mAggregations.template.mBindingInfos.value.parts[0].path;
                }
                
                _this._aColumns[pModel].filter(item => item.ColumnName === sColName)
                    .forEach(ci => {
                        if (ci.Editable) {
                            if (ci.ValueHelp["show"]) {
                                var bValueFormatter = false;
                                var sSuggestItemText = ci.ValueHelp["SuggestionItems"].text;
                                var sSuggestItemAddtlText = ci.ValueHelp["SuggestionItems"].additionalText !== undefined ? ci.ValueHelp["SuggestionItems"].additionalText : '';                                    
                                var sTextFormatMode = "Key";

                                if (ci.TextFormatMode && ci.TextFormatMode !== "" && ci.TextFormatMode !== "Key" && ci.ValueHelp["items"].value !== ci.ValueHelp["items"].text) {
                                    sTextFormatMode = ci.TextFormatMode;
                                    bValueFormatter = true;

                                    if (ci.ValueHelp["SuggestionItems"].additionalText && ci.ValueHelp["SuggestionItems"].text !== ci.ValueHelp["SuggestionItems"].additionalText) {
                                        if (sTextFormatMode === "ValueKey" || sTextFormatMode === "Value") {
                                            sSuggestItemText = ci.ValueHelp["SuggestionItems"].additionalText;
                                            sSuggestItemAddtlText = ci.ValueHelp["SuggestionItems"].text;
                                        }
                                    }
                                }
                                
                                var oInput = new sap.m.Input({
                                    type: "Text",
                                    showValueHelp: true,
                                    valueHelpRequest: TableValueHelp.handleTableValueHelp.bind(this),
                                    showSuggestion: true,
                                    maxSuggestionWidth: ci.ValueHelp["SuggestionItems"].additionalText !== undefined ? ci.ValueHelp["SuggestionItems"].maxSuggestionWidth : "1px",
                                    suggestionItems: {
                                        path: ci.ValueHelp["SuggestionItems"].path,
                                        length: 10000,
                                        template: new sap.ui.core.ListItem({
                                            key: ci.ValueHelp["SuggestionItems"].text,
                                            text: sSuggestItemText,
                                            additionalText: sSuggestItemAddtlText,
                                        }),
                                        templateShareable: false
                                    },
                                    // suggest: this.handleSuggestion.bind(this),
                                    change: this.onValueHelpInputChange.bind(this)
                                })

                                if (bValueFormatter) {
                                    oInput.setProperty("textFormatMode", sTextFormatMode)

                                    oInput.bindValue({  
                                        parts: [{ path: pModel + ">" + sColName }, { value: ci.ValueHelp["items"].path }, { value: ci.ValueHelp["items"].value }, { value: ci.ValueHelp["items"].text }, { value: sTextFormatMode }],
                                        formatter: this.formatValueHelp.bind(this)
                                    });
                                }
                                else {
                                    oInput.bindValue({  
                                        parts: [  
                                            { path: pModel + ">" + sColName }
                                        ]
                                    });
                                }

                                oInput.addEventDelegate(oInputEventDelegate);

                                col.setTemplate(oInput);
                            }
                            else if (ci.DataType === "BOOLEAN") {
                                col.setTemplate(new sap.m.CheckBox({selected: "{" + pModel + ">" + sColName + "}",  
                                    editable: true
                                }));
                            }
                            else if (ci.DataType === "NUMBER") {
                                col.setTemplate(new sap.m.Input({
                                    type: sap.m.InputType.Number,
                                    textAlign: sap.ui.core.TextAlign.Right,
                                    // value: "{" + pModel + ">" + sColName + "}",
                                    value: "{path:'" + pModel + ">" + sColName + "', formatOptions:{ minFractionDigits:" + ci.Decimal + ", maxFractionDigits:" + ci.Decimal + " }, constraints:{ precision:" + ci.Length + ", scale:" + ci.Decimal + " }}",
                                    liveChange: this.onNumberLiveChange.bind(this), 
                                    enabled: true
                                }).addEventDelegate(oInputEventDelegate));
                            }
                            else if (ci.DataType === "DATE") {
                                col.setTemplate(new sap.m.DatePicker({
                                    value: "{" + pModel + ">" + sColName + "}",
                                    displayFormat: "MM/dd/yyyy",
                                    valueFormat: "MM/dd/yyyy",
                                    change: this.onDateChange.bind(this),
                                    navigate: this.onClickDate.bind(this)
                                }))
                            }
                            else {
                                col.setTemplate(new sap.m.Input({
                                    value: "{" + pModel + ">" + sColName + "}",
                                    liveChange: this.onInputLiveChange.bind(this)
                                }).addEventDelegate(oInputEventDelegate));
                            }
                        }

                        if (ci.Mandatory) {
                            col.getLabel().addStyleClass("sapMLabelRequired");
                        }
                    })                
            })

            _this.getView().getModel(pModel).getData().results.forEach(item => item.Edited = false);

            _this.getView().getModel("base").setProperty("/dataMode", "EDIT");
        },

        handleValueHelp: function(oEvent) {
            var oModel = this.getOwnerComponent().getModel();
            var oSource = oEvent.getSource();
            console.log("handleValueHelp", oSource);
            var sEntity = oSource.getBindingInfo("suggestionItems").path;
            var sModel = oSource.getBindingInfo("value").parts[0].model;

            this._inputId = oSource.getId();
            this._inputValue = oSource.getValue();
            this._inputSource = oSource;
            this._inputField = oSource.getBindingInfo("value").parts[0].path;

            var vCellPath = _this._inputField;
            var vColProp = _this._aColumns[sModel].filter(item => item.ColumnName === vCellPath);
            var vItemValue = vColProp[0].valueHelp.items.value;
            var vItemDesc = vColProp[0].valueHelp.items.text;

            var sFilter = "";

            if (this._inputField == "DESTHUID") {
                var sPath = oSource.getParent().oBindingContexts[sModel].sPath;
                var oHu = _this.getView().getModel("hu").getProperty(sPath);
                var oHdr = _this.getView().getModel("hdr").getData().results[0];
                sEntity = "/InfoHUDestSet";
                
                sFilter = "HUTYPE eq '" + oHu.HUTYPE + "' and PLANTCD eq '" + oHdr.ISSPLANT + "' and SLOC eq '" + oHu.SLOC + 
                    "' and WAREHOUSE eq '" + oHdr.WAREHOUSE + "' and STORAGEAREA eq '" + oHdr.STORAGEAREA + "'";

                //console.log("DESTHUID", sFilter)
            }
            
            oModel.read(sEntity, {
                urlParameters: {
                    "$filter": sFilter
                },
                success: function (data, response) {
                    console.log("handleValueHelp", data)
                    data.results.forEach(item => {
                        item.VHTitle = item[vItemValue];
                        item.VHDesc = ""; //item[vItemDesc];
                        item.VHSelected = (item[vItemValue] === _this._inputValue);
                    });

                    // create value help dialog
                    if (!_this._valueHelpDialog) {
                        _this._valueHelpDialog = sap.ui.xmlfragment(
                            "zuiporel.view.fragments.dialog.ValueHelpDialog",
                            _this
                        );

                        _this._valueHelpDialog.setModel(
                            new JSONModel({
                                items: data.results,
                                title: vColProp[0].label,
                                table: sModel
                            })
                        )

                        _this.getView().addDependent(_this._valueHelpDialog);
                    }
                    else {
                        _this._valueHelpDialog.setModel(
                            new JSONModel({
                                items: data.results,
                                title: vColProp[0].label,
                                table: sModel
                            })
                        )
                    }                            

                    _this._valueHelpDialog.open();
                    console.log(_this.getView())
                },
                error: function (err) { 
                    _this.closeLoadingDialog();
                }
            })
        },

        handleValueHelpSearch : function (oEvent) {
            var sValue = oEvent.getParameter("value");

            var oFilter = new sap.ui.model.Filter({
                filters: [
                    new sap.ui.model.Filter("VHTitle", sap.ui.model.FilterOperator.Contains, sValue),
                    new sap.ui.model.Filter("VHDesc", sap.ui.model.FilterOperator.Contains, sValue)
                ],
                and: false
            });

            oEvent.getSource().getBinding("items").filter([oFilter]);
        },

        handleValueHelpClose : function (oEvent) {               
            if (oEvent.sId === "confirm") {                  
                var oSelectedItem = oEvent.getParameter("selectedItem");               
                //var sTable = this._oViewSettingsDialog["zuiporel.view.fragments.ValueHelpDialog"].getModel().getData().table;
                var sTable = this._valueHelpDialog.getModel().getData().table;

                if (oSelectedItem) {
                    this._inputSource.setValue(oSelectedItem.getTitle());

                    if (this._inputValue !== oSelectedItem.getTitle()) {
                        var sRowPath = this._inputSource.getBindingInfo("value").binding.oContext.sPath;
                        this.getView().getModel(sTable).setProperty(sRowPath + '/Edited', true);
                    }
                }

                this._inputSource.setValueState("None");
                this.addRemoveValueState(true, this._inputSource.getId());
            }
        },

        handleFormValueHelp: function (oEvent) {
            TableValueHelp.handleFormValueHelp(oEvent, this);
        },

        onValueHelpRequest: async function(oEvent) {
            TableValueHelp.handleTableValueHelp(oEvent);
        },

        onValueHelpInputChange: function(oEvent) {
            if (this._validationErrors === undefined) this._validationErrors = [];

            var oSource = oEvent.getSource();
            var isInvalid = !oSource.getSelectedKey() && oSource.getValue().trim();
            oSource.setValueState(isInvalid ? "Error" : "None");

            // var sRowPath = oSource.getBindingInfo("value").binding.oContext.sPath;
            var sRowPath = "";
            var sModel = oSource.getBindingInfo("value").parts[0].model;

            oSource.getSuggestionItems().forEach(item => {
                if (item.getProperty("key") === oSource.getValue().trim()) {
                    isInvalid = false;
                    oSource.setValueState(isInvalid ? "Error" : "None");
                }
            })

            if (isInvalid) this._validationErrors.push(oEvent.getSource().getId());
            else {
                this._validationErrors.forEach((item, index) => {
                    if (item === oEvent.getSource().getId()) {
                        this._validationErrors.splice(index, 1)
                    }
                })
            }

            sRowPath = oSource.oParent.getBindingContext(sModel).sPath;
            this.getView().getModel(sModel).setProperty(sRowPath + '/' + oSource.getBindingInfo("value").parts[0].path, oSource.getSelectedKey());
        },

        onValueHelpLiveInputChange: function(oEvent) {
            var oSource = oEvent.getSource();
            var isInvalid = !oSource.getSelectedKey() && oSource.getValue().trim();
            oSource.setValueState(isInvalid ? "Error" : "None");

            if (!oSource.getSelectedKey()) {
                oSource.getSuggestionItems().forEach(item => {
                    if (item.getProperty("key") === oSource.getValue().trim()) {
                        console.log("test2", item.getProperty("key"))
                        isInvalid = false;
                        oSource.setValueState(isInvalid ? "Error" : "None");
                    }
                })
            }

            this.addRemoveValueState(!isInvalid, oSource.getId());

            var sRowPath = oSource.getBindingInfo("value").binding.oContext.sPath;
            var sModel = oSource.getBindingInfo("value").parts[0].model;
            var sColumn = oSource.getBindingInfo("value").parts[0].path;
            this.getView().getModel(sModel).setProperty(sRowPath + '/' + sColumn, oSource.mProperties.selectedKey);
            this.getView().getModel(sModel).setProperty(sRowPath + '/Edited', true);
        },

        addRemoveValueState(pIsValid, pId) {
            console.log("addRemoveValueState", this._aInvalidValueState, pIsValid, pId)
            if (!pIsValid) {
                if (!this._aInvalidValueState.includes(pId)) {
                    this._aInvalidValueState.push(pId);
                }
            } else {
                if (this._aInvalidValueState.includes(pId)) {
                    for(var i = this._aInvalidValueState.length - 1; i >= 0; i--) {
                        if (this._aInvalidValueState[i] == pId){
                            this._aInvalidValueState.splice(i, 1)
                        }
                        
                    }
                }
            }
        },

        onFilterBySmart(pModel, pFilters, pFilterGlobal, pFilterTab) {
            var oFilter = null;
            var aFilter = [];
            var aFilterGrp = [];
            var aFilterCol = [];

            if (pFilters.length > 0 && pFilters[0].aFilters) {
                console.log("pFilters", pFilters)
                pFilters[0].aFilters.forEach(x => {
                    if (Object.keys(x).includes("aFilters")) {
                        x.aFilters.forEach(y => {
                            console.log("aFilters", y, this._aColumns[pModel])
                            var sName = this._aColumns[pModel].filter(item => item.ColumnName.toUpperCase() == y.sPath.toUpperCase())[0].ColumnName;
                            aFilter.push(new Filter(sName, FilterOperator.Contains, y.oValue1));

                            //if (!aFilterCol.includes(sName)) aFilterCol.push(sName);
                        });
                        var oFilterGrp = new Filter(aFilter, false);
                        aFilterGrp.push(oFilterGrp);
                        aFilter = [];
                    } else {
                        var sName = this._aColumns[pModel].filter(item => item.ColumnName.toUpperCase() == x.sPath.toUpperCase())[0].ColumnName;
                        aFilter.push(new Filter(sName, FilterOperator.Contains, x.oValue1));
                        var oFilterGrp = new Filter(aFilter, false);
                        aFilterGrp.push(oFilterGrp);
                        aFilter = [];
                    }
                });
            } else if (pFilters.length > 0) {
                var sName = pFilters[0].sPath;
                aFilter.push(new Filter(sName, FilterOperator.EQ,  pFilters[0].oValue1));
                var oFilterGrp = new Filter(aFilter, false);
                aFilterGrp.push(oFilterGrp);
                aFilter = [];
            }

            if (pFilterGlobal) {
                this._aColumns[pModel].forEach(item => {
                    if (item.DataType === "BOOLEAN") aFilter.push(new Filter(item.ColumnName, FilterOperator.EQ, pFilterGlobal));
                    else aFilter.push(new Filter(item.ColumnName, FilterOperator.Contains, pFilterGlobal));
                })

                var oFilterGrp = new Filter(aFilter, false);
                aFilterGrp.push(oFilterGrp);
                aFilter = [];
            }

            oFilter = new Filter(aFilterGrp, true);

            this.byId(pModel + "Tab").getBinding("rows").filter(oFilter, "Application");

            // Filter by Table columns
            _this.onFilterByCol(pModel, pFilterTab);
        },

        onFilterByCol(pModel, pFilterTab) {
            if (pFilterTab.length > 0) {
                pFilterTab.forEach(item => {
                    var iColIdx = _this._aColumns[pModel].findIndex(x => x.ColumnName == item.sPath);
                    _this.getView().byId(pModel + "Tab").filter(_this.getView().byId(pModel + "Tab").getColumns()[iColIdx], 
                        item.oValue1);
                });
            }
        },

        onFilterByGlobal(oEvent) {
            var oTable = oEvent.getSource().oParent.oParent;
            var sTable = oTable.getBindingInfo("rows").model;
            var sQuery = oEvent.getParameter("query");
            var oFilter = null;
            var aFilter = [];

            if (sQuery) {
                this._aColumns[sTable].forEach(item => {
                    if (item.Visible) {
                        if (item.DataType === "BOOLEAN") aFilter.push(new Filter(item.ColumnName, FilterOperator.EQ, sQuery));
                        else aFilter.push(new Filter(item.ColumnName, FilterOperator.Contains, sQuery));
                    }
                })

                oFilter = new Filter(aFilter, false);
            }

            this.byId(sTable + "Tab").getBinding("rows").filter(oFilter, "Application");
        },

        clearSortFilter(pTable) {
            var oTable = this.byId(pTable);
            var oColumns = oTable.getColumns();
            for (var i = 0, l = oColumns.length; i < l; i++) {

                if (oColumns[i].getFiltered()) {
                    oColumns[i].filter("");
                }

                if (oColumns[i].getSorted()) {
                    oColumns[i].setSorted(false);
                }
            }
        },
   
        showLoadingDialog(pTitle) {
            if (!_this._LoadingDialog) {
                _this._LoadingDialog = sap.ui.xmlfragment("zuiporel.view.fragments.dialog.LoadingDialog", _this);
                _this.getView().addDependent(_this._LoadingDialog);
            } 
            
            _this._LoadingDialog.setTitle(pTitle);
            _this._LoadingDialog.open();
        },

        closeLoadingDialog() {
            _this._LoadingDialog.close();
        },

        formatDate(pDate) {
            return _sapDateFormat.format(new Date(pDate));
        },

        formatDatePH(pDate) {
            return _sapDateFormatPH.format(new Date(pDate));
        },

        formatTime(pTime) {
            var time = pTime.split(':');
            let now = new Date();
            return (new Date(now.getFullYear(), now.getMonth(), now.getDate(), ...time)).toLocaleTimeString();
        },

        onSelectTab: function(oEvent) {
            _this._tableRendered = oEvent.getSource().getSelectedKey() + "Tab";
            _this.setActiveRowHighlight(oEvent.getSource().getSelectedKey());
            
            this._sActiveTable = _this._tableRendered;
        },

        onAfterTableRendering: function(oEvent) {
            if (this._tableRendered !== "") {
                this.setActiveRowHighlight(this._tableRendered.replace("Tab", ""));
                this._tableRendered = "";
            } 
        },

        onTableClick(oEvent) {
            var oControl = oEvent.srcControl;
            var sTabId = oControl.sId.split("--")[oControl.sId.split("--").length - 1];

            while (sTabId.substr(sTabId.length - 3) !== "Tab") {                    
                oControl = oControl.oParent;
                sTabId = oControl.sId.split("--")[oControl.sId.split("--").length - 1];
            }
            
            this._sActiveTable = sTabId;
        },

        onFirstVisibleRowChanged: function (oEvent) {
            var oSource = oEvent.getSource();
            var sModel = oSource.mBindingInfos.rows.model;
            var oTable = oEvent.getSource();

            setTimeout(() => {
                var oData = oTable.getModel(sModel).getData().results;
                var iStartIndex = oTable.getBinding("rows").iLastStartIndex;
                var iLength = oTable.getBinding("rows").iLastLength + iStartIndex;

                if (oTable.getBinding("rows").aIndices.length > 0) {
                    for (var i = iStartIndex; i < iLength; i++) {
                        var iDataIndex = oTable.getBinding("rows").aIndices.filter((fItem, fIndex) => fIndex === i);

                        if (oData[iDataIndex].ACTIVE === "X") oTable.getRows()[iStartIndex === 0 ? i : i - iStartIndex].addStyleClass("activeRow");
                        else oTable.getRows()[iStartIndex === 0 ? i : i - iStartIndex].removeStyleClass("activeRow");
                    }
                }
                else {
                    for (var i = iStartIndex; i < iLength; i++) {
                        if (oData[i].ACTIVE === "X") oTable.getRows()[iStartIndex === 0 ? i : i - iStartIndex].addStyleClass("activeRow");
                        else oTable.getRows()[iStartIndex === 0 ? i : i - iStartIndex].removeStyleClass("activeRow");
                    }
                }
            }, 1);
        },

        onFilter: function(oEvent) {
            var oTable = oEvent.getSource();
            var oSource = oEvent.getSource();
            var sModel = oSource.mBindingInfos.rows.model;

            this.setActiveRowHighlight(sModel);
        },

        onColumnUpdated: function (oEvent) {
            var oSource = oEvent.getSource();
            var sModel = oSource.mBindingInfos.rows.model;

            this.setActiveRowHighlight(sModel);
        },

        setActiveRowHighlight(pModel) {
            var oTable = this.byId(pModel + "Tab");
            
            setTimeout(() => {
                var iActiveRowIndex = oTable.getModel(pModel).getData().results.findIndex(item => item.ACTIVE === "X");

                oTable.getRows().forEach(row => {
                    if (row.getBindingContext(pModel) && +row.getBindingContext(pModel).sPath.replace("/results/", "") === iActiveRowIndex) {
                        row.addStyleClass("activeRow");
                    }
                    else row.removeStyleClass("activeRow");
                })
            }, 1);
        },

        setActiveRowFocus(pModel) {
            // Highligh first editable column on edit
            var oTable = this.byId(pModel + "Tab");

            setTimeout(() => {
                var iActiveRowIndex = oTable.getModel(pModel).getData().results.findIndex(item => item.ACTIVE === "X");
                var aRows = oTable.getRows();
                var sInputId = ""

                if (document.getElementsByClassName("sapMInputFocused").length > 0) {
                    sInputId = document.getElementsByClassName("sapMInputFocused")[0].id;
                } else {
                    var oCell = aRows[iActiveRowIndex].getCells().filter(x => x.sId.includes("input"))[0];
                    sInputId = oCell.sId;
                }

                //var sColumn = _this._aColumns[pModel].filter(x => x.updatable == true)[0]["name"];
                
                //oCell.focus();
                document.getElementById(sInputId + "-inner").select();
            }, 1);
        },

        onInputKeyDown(oEvent) {
            if (oEvent.key === "ArrowUp" || oEvent.key === "ArrowDown") {
                //prevent increase/decrease of number value
                oEvent.preventDefault();
                
                var sTableId = oEvent.srcControl.oParent.oParent.sId;
                var oTable = _this.byId(sTableId);
                var sModel = oEvent.srcControl.oParent.oParent.mBindingInfos.rows.model;
                var sColumnName = oEvent.srcControl.getBindingInfo("value").parts[0].path;
                var sCurrentRowIndex = +oEvent.srcControl.oParent.oBindingContexts[sModel].sPath.replace("/results/", "");
                var sColumnIndex = -1;
                var sCurrentRow = -1;
                var sNextRow = -1;
                var sActiveRow = -1;
                var iFirstVisibleRowIndex = oTable.getFirstVisibleRow();
                var iVisibleRowCount = oTable.getVisibleRowCount();
                
                // oTable.getModel().setProperty(oEvent.srcControl.oParent.getBindingContext().sPath + "/" + oEvent.srcControl.getBindingInfo("value").parts[0].path, oEvent.srcControl.getValue());
                
                //get active row (arrow down)
                oTable.getBinding("rows").aIndices.forEach((item, index) => {
                    if (item === sCurrentRowIndex) { sCurrentRow = index; }
                    if (sCurrentRow !== -1 && sActiveRow === -1) { 
                        if ((sCurrentRow + 1) === index) { sActiveRow = item }
                        else if ((index + 1) === oTable.getBinding("rows").aIndices.length) { sActiveRow = item }
                    }
                })
                
                //clear active row
                
                oTable.getModel().getData().rows.forEach(row => row.ACTIVE = "");
                _this.getView().getModel(sModel).getData().results.forEach(item => {
                    item.ACTIVE = "";
                });

                //get next row to focus and active row (arrow up)
                if (oEvent.key === "ArrowUp") { 
                    if (sCurrentRow !== 0) {
                        sActiveRow = oTable.getBinding("rows").aIndices.filter((fItem, fIndex) => fIndex === (sCurrentRow - 1))[0];
                    }
                    else { sActiveRow = oTable.getBinding("rows").aIndices[0] }

                    sCurrentRow = sCurrentRow === 0 ? sCurrentRow : sCurrentRow - iFirstVisibleRowIndex;
                    sNextRow = sCurrentRow === 0 ? 0 : sCurrentRow - 1;
                }
                else if (oEvent.key === "ArrowDown") { 
                    sCurrentRow = sCurrentRow - iFirstVisibleRowIndex;
                    sNextRow = sCurrentRow + 1;
                }

                //set active row
                _this.getView().getModel(sModel).setProperty("/results/" + sActiveRow + "/ACTIVE", "X");

                //auto-scroll up/down
                if (oEvent.key === "ArrowDown" && (sNextRow + 1) < oTable.getModel().getData().rows.length && (sNextRow + 1) > iVisibleRowCount) {
                    oTable.setFirstVisibleRow(iFirstVisibleRowIndex + 1);
                }   
                else if (oEvent.key === "ArrowUp" && sCurrentRow === 0 && sNextRow === 0 && iFirstVisibleRowIndex !== 0) { 
                    oTable.setFirstVisibleRow(iFirstVisibleRowIndex - 1);
                }

                //get the cell to focus
                oTable.getRows()[sCurrentRow].getCells().forEach((cell, index) => {
                    if (cell.getBindingInfo("value") !== undefined) {
                        if (cell.getBindingInfo("value").parts[0].path === sColumnName) { sColumnIndex = index; }
                    }
                })
                
                if (oEvent.key === "ArrowDown") {
                    sNextRow = sNextRow === iVisibleRowCount ? sNextRow - 1 : sNextRow;
                }

                //set focus on cell
                setTimeout(() => {
                    oTable.getRows()[sNextRow].getCells()[sColumnIndex].focus();
                    oTable.getRows()[sNextRow].getCells()[sColumnIndex].getFocusDomRef().select();
                }, 100);

                //set row highlight
                _this.setActiveRowHighlight(sModel);
            }
        },

        onCellClick: function(oEvent) {
            if (oEvent.getParameters().rowBindingContext) {
                var oTable = oEvent.getSource();
                var sRowPath = oEvent.getParameters().rowBindingContext.sPath;
                var sModel = oEvent.getSource().mBindingInfos.rows.model;

                oTable.getModel(sModel).getData().results.forEach(row => row.ACTIVE = "");
                oTable.getModel(sModel).setProperty(sRowPath + "/ACTIVE", "X"); 
                
                oTable.getRows().forEach(row => {
                    if (row.getBindingContext(sModel) && row.getBindingContext(sModel).sPath.replace("/results/", "") === sRowPath.replace("/results/", "")) {
                        row.addStyleClass("activeRow");
                    }
                    else row.removeStyleClass("activeRow");
                })
            }
        },

        //******************************************* */
        // Column Filtering
        //******************************************* */

        onColFilterClear: function(oEvent) {
            console.log("onColFilterClear")
            TableFilter.onColFilterClear(oEvent, this);
        },

        onColFilterCancel: function(oEvent) {
            console.log("onColFilterCancel")
            TableFilter.onColFilterCancel(oEvent, this);
        },

        onColFilterConfirm: function(oEvent) {
            console.log("onColFilterConfirm")
            TableFilter.onColFilterConfirm(oEvent, this);
        },

        onFilterItemPress: function(oEvent) {
            TableFilter.onFilterItemPress(oEvent, this);
        },

        onFilterValuesSelectionChange: function(oEvent) {
            TableFilter.onFilterValuesSelectionChange(oEvent, this);
        },

        onSearchFilterValue: function(oEvent) {
            TableFilter.onSearchFilterValue(oEvent, this);
        },

        onCustomColFilterChange: function(oEvent) {
            TableFilter.onCustomColFilterChange(oEvent, this);
        },

        onSetUseColFilter: function(oEvent) {
            TableFilter.onSetUseColFilter(oEvent, this);
        },

        onRemoveColFilter: function(oEvent) {
            TableFilter.onRemoveColFilter(oEvent, this);
        },
    });
   
  });