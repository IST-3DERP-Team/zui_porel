sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
    'sap/ui/model/Sorter',
    "sap/ui/Device",
    "sap/ui/table/library",
    "sap/m/TablePersoController",
    'sap/m/MessageToast',
	'sap/m/SearchField',
    "sap/ui/export/Spreadsheet",
    "../js/Common",
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, JSONModel, MessageBox, Filter, FilterOperator, Sorter, Device, library, TablePersoController, MessageToast, SearchField, Spreadsheet, Common) {
        "use strict";

        var _this;
        var _startUpInfo = {};
        var _oCaption = {};
        var _aRelCd = [];

        // shortcut for sap.ui.table.SortOrder
        var SortOrder = library.SortOrder;
        var dateFormat = sap.ui.core.format.DateFormat.getDateInstance({pattern : "MM/dd/yyyy" });
        var sapDateFormat = sap.ui.core.format.DateFormat.getDateInstance({pattern : "yyyy-MM-dd" });

        return Controller.extend("zuiporel.controller.Main", {
            onInit: function () {
                _this = this;

                if (sap.ushell.Container) {
                    var oModelStartUp= new sap.ui.model.json.JSONModel();
                    oModelStartUp.loadData("/sap/bc/ui2/start_up").then(() => {
                        _startUpInfo = oModelStartUp.oData;
                    });
                }
                else {
                    _startUpInfo.id = "BAS_CONN";
                }

                this.initializeComponent();

                this._oSortDialog = null;
                this._oFilterDialog = null;
                this._oViewSettingsDialog = {};

                this._aEntitySet = {
                    poRel: "POReleaseSet"
                };

                this._aColumns = {};
                this._aSortableColumns = {};
                this._aFilterableColumns = {};
                
                this._oDataBeforeChange = {};
                this._aInvalidValueState = [];

                this._aPOResultData = [];
            },

            onExit() {

            },
            
            initializeComponent() {
                this.showLoadingDialog("Loading...");

                // Get Captions
                this.getCaption();

                // Get Release Group
                this.getRelGrp();

                // Get Release Code
                this.getRelCd();

                // Get Columns
                this.getColumns();

                // Get Data
                this.getPORel([], "");
                this.byId("btnReleaseSave").setEnabled(true);
                this.byId("btnCancelReleaseSave").setEnabled(true);
                this.byId("btnRejectSave").setEnabled(true);
                this.byId("btnPrintPreview").setEnabled(true);
                this.byId("btnExport").setEnabled(true);
                this.byId("btnRefresh").setEnabled(true);

                // Add header search field
                var oSmartFilter = this.getView().byId("sfbPORel");
                if (oSmartFilter) {
                    oSmartFilter.attachFilterChange(function(oEvent) {});
                }

                var oModel = this.getOwnerComponent().getModel("ZVB_3DERP_PORELFILTER_CDS");
                oSmartFilter.setModel(oModel);

                // this.byId("btnReleaseSave").setEnabled(false);
                // this.byId("btnCancelReleaseSave").setEnabled(false);
                // this.byId("btnRejectSave").setEnabled(false);
                // this.byId("btnPrintPreview").setEnabled(false);
                // this.byId("btnExport").setEnabled(false);
                // this.byId("btnRefresh").setEnabled(false);

                this._tableRendered = "";
                var oTableEventDelegate = {
                    onkeyup: function(oEvent){
                        _this.onKeyUp(oEvent);
                    },

                    onAfterRendering: function(oEvent) {
                        _this.onAfterTableRendering(oEvent);
                    }
                };

                this.byId("poRelTab").addEventDelegate(oTableEventDelegate);

                var testDelegate = {
                    change: function(oEvent){
                        _this.onChangeSmartFilter(oEvent);
                    }
                };

                this.byId("filterRelGrp").addEventDelegate(testDelegate)
            },

            onAfterTableRendering: function(oEvent) {
                if (this._tableRendered !== "") {
                    this.setActiveRowHighlight(this._tableRendered.replace("Tab", ""));
                    this._tableRendered = "";
                } 
            },

            getColumns: async function() {
                var oModelColumns = new JSONModel();
                var sPath = jQuery.sap.getModulePath("zuiporel", "/model/columns.json")
                await oModelColumns.loadData(sPath);

                var oColumns = oModelColumns.getData();
                var oModel = this.getOwnerComponent().getModel();

                oModel.metadataLoaded().then(() => {
                    this.getDynamicColumns(oColumns, "PORELMOD", "ZDV_POREL");
                })
            },

            getDynamicColumns(arg1, arg2, arg3) {
                var oColumns = arg1;
                var modCode = arg2;
                var tabName = arg3;

                //get dynamic columns based on saved layout or ZERP_CHECK
                var oJSONColumnsModel = new JSONModel();
                // this.oJSONModel = new JSONModel();
                var vSBU = "VER"; //this.getView().getModel("ui").getData().activeSbu;

                var oModel = this.getOwnerComponent().getModel("ZGW_3DERP_COMMON_SRV");
                // console.log(oModel)
                oModel.setHeaders({
                    sbu: vSBU,
                    type: modCode,
                    tabname: tabName
                });
                
                oModel.read("/ColumnsSet", {
                    success: function (oData, oResponse) {
                        oJSONColumnsModel.setData(oData);
                        // _this.getView().setModel(oJSONColumnsModel, "columns"); //set the view model

                        if (oData.results.length > 0) {
                            // console.log(modCode)
                            if (modCode === 'PORELMOD') {
                                var aColumns = _this.setTableColumns(oColumns["poRel"], oData.results);                               
                                _this._aColumns["poRel"] = aColumns["columns"];
                                _this._aSortableColumns["poRel"] = aColumns["sortableColumns"];
                                _this._aFilterableColumns["poRel"] = aColumns["filterableColumns"]; 
                                _this.addColumns(_this.byId("poRelTab"), aColumns["columns"], "poRel");
                            }
                        }
                    },
                    error: function (err) {
                        _this.closeLoadingDialog();
                    }
                });
            },

            setTableColumns: function(arg1, arg2) {
                var oColumn = arg1;
                var oMetadata = arg2;
                
                var aSortableColumns = [];
                var aFilterableColumns = [];
                var aColumns = [];

                oMetadata.forEach((prop, idx) => {
                    var vCreatable = prop.Creatable;
                    var vUpdatable = prop.Editable;
                    var vSortable = true;
                    var vSorted = prop.Sorted;
                    var vSortOrder = prop.SortOrder;
                    var vFilterable = true;
                    var vName = prop.ColumnLabel;
                    var oColumnLocalProp = oColumn.filter(col => col.name.toUpperCase() === prop.ColumnName);
                    var vShowable = true;
                    var vOrder = prop.Order;

                    // console.log(prop)
                    if (vShowable) {
                        //sortable
                        if (vSortable) {
                            aSortableColumns.push({
                                name: prop.ColumnName, 
                                label: vName, 
                                position: +vOrder, 
                                sorted: vSorted,
                                sortOrder: vSortOrder
                            });
                        }

                        //filterable
                        if (vFilterable) {
                            aFilterableColumns.push({
                                name: prop.ColumnName, 
                                label: vName, 
                                position: +vOrder,
                                value: "",
                                connector: "Contains"
                            });
                        }
                    }

                    //columns
                    aColumns.push({
                        name: prop.ColumnName, 
                        label: vName, 
                        position: +vOrder,
                        type: prop.DataType,
                        creatable: vCreatable,
                        updatable: vUpdatable,
                        sortable: vSortable,
                        filterable: vFilterable,
                        visible: prop.Visible,
                        required: prop.Mandatory,
                        width: prop.ColumnWidth + 'px',
                        sortIndicator: vSortOrder === '' ? "None" : vSortOrder,
                        hideOnChange: false,
                        valueHelp: oColumnLocalProp.length === 0 ? {"show": false} : oColumnLocalProp[0].valueHelp,
                        showable: vShowable,
                        key: prop.Key === '' ? false : true,
                        maxLength: prop.Length,
                        precision: prop.Decimal,
                        scale: prop.Scale !== undefined ? prop.Scale : null
                    })
                })

                aSortableColumns.sort((a,b) => (a.position > b.position ? 1 : -1));
                this.createViewSettingsDialog("sort", 
                    new JSONModel({
                        items: aSortableColumns,
                        rowCount: aSortableColumns.length,
                        activeRow: 0,
                        table: ""
                    })
                );

                aFilterableColumns.sort((a,b) => (a.position > b.position ? 1 : -1));
                this.createViewSettingsDialog("filter", 
                    new JSONModel({
                        items: aFilterableColumns,
                        rowCount: aFilterableColumns.length,
                        table: ""
                    })
                );

                aColumns.sort((a,b) => (a.position > b.position ? 1 : -1));
                var aColumnProp = aColumns.filter(item => item.showable === true);

                this.createViewSettingsDialog("column", 
                    new JSONModel({
                        items: aColumnProp,
                        rowCount: aColumnProp.length,
                        table: ""
                    })
                );

                
                return { columns: aColumns, sortableColumns: aSortableColumns, filterableColumns: aFilterableColumns };
            },

            addColumns(table, columns, model) {
                var aColumns = columns.filter(item => item.showable === true)
                aColumns.sort((a,b) => (a.position > b.position ? 1 : -1));

                aColumns.forEach(col => {
                    // console.log(col)
                    if (col.type === "STRING" || col.type === "DATETIME") {
                        table.addColumn(new sap.ui.table.Column({
                            id: model + "Col" + col.name,
                            // id: col.name,
                            width: col.width,
                            sortProperty: col.name,
                            filterProperty: col.name,
                            label: new sap.m.Text({text: col.label}),
                            template: new sap.m.Text({text: "{" + model + ">" + col.name + "}"}),
                            visible: col.visible
                        }));
                    }
                    else if (col.type === "NUMBER") {
                        table.addColumn(new sap.ui.table.Column({
                            id: model + "Col" + col.name,
                            width: col.width,
                            hAlign: "End",
                            sortProperty: col.name,
                            filterProperty: col.name,
                            label: new sap.m.Text({text: col.label}),
                            template: new sap.m.Text({text: "{" + model + ">" + col.name + "}"}),
                            visible: col.visible
                        }));
                    }
                    else if (col.type === "BOOLEAN" ) {
                        table.addColumn(new sap.ui.table.Column({
                            id: model + "Col" + col.name,
                            width: col.width,
                            hAlign: "Center",
                            sortProperty: col.name,
                            filterProperty: col.name,                            
                            label: new sap.m.Text({text: col.label}),
                            template: new sap.m.CheckBox({selected: "{" + model + ">" + col.name + "}", editable: false}),
                            visible: col.visible
                        }));
                    }
                })
            },

            onChangeSmartFilter(oEvent) {
                console.log("onChangeSmartFilter", oEvent)
            },

            getRelGrp() {
                var oModel = this.getOwnerComponent().getModel("ZVB_3DERP_PORELFILTER_CDS");
                oModel.read('/ZVB_3DERP_PORELGRP', {
                    success: function (data, response) {
                        //console.log("POReleaseGrp", data);
                        var oJSONModel = new JSONModel();
                        oJSONModel.setData(data);
                        _this.getView().setModel(oJSONModel, "relGrp");
                    },
                    error: function (err) { 
                        console.log("error", err)
                    }
                })
            },

            getRelCd() {
                var oModel = this.getOwnerComponent().getModel("ZVB_3DERP_PORELFILTER_CDS");
                oModel.read('/ZVB_3DERP_PORELCD', {
                    success: function (data, response) {
                        //console.log("POReleaseCd", data);
                        _aRelCd = data.results;
                    },
                    error: function (err) { 
                        console.log("error", err)
                    }
                })
            },

            onSelectionChangeRelGrp(oEvent) {
                //console.log("onSelectionChangeRelGrp");
                var sSelectedKey = this.getView().byId("cmbRelGrp").getSelectedKey();
                var oRelCd = {results: []};
                _aRelCd.forEach(item => {
                    if (item.RELGRP == sSelectedKey) {
                        oRelCd.results.push({
                            RELCD: item.RELCD,
                            DESCRIPTION: item.DESCRIPTION
                        });

                        var oJSONModel = new JSONModel();
                        oJSONModel.setData(oRelCd);
                        _this.getView().setModel(oJSONModel, "relCd");
                    }
                })
            },

            onSearch(oEvent) {
                this.showLoadingDialog("Loading...");

                var aFilters = this.getView().byId("sfbPORel").getFilters();
                var sFilterGlobal = "";
                if (oEvent) sFilterGlobal = oEvent.getSource()._oBasicSearchField.mProperties.value;
                
                this.getPORel(aFilters, sFilterGlobal);

                this.byId("btnReleaseSave").setEnabled(true);
                this.byId("btnCancelReleaseSave").setEnabled(true);
                this.byId("btnRejectSave").setEnabled(true);
                this.byId("btnPrintPreview").setEnabled(true);
                this.byId("btnExport").setEnabled(true);
                this.byId("btnRefresh").setEnabled(true);
            },

            getPORel(pFilters, pFilterGlobal) {
                console.log("getPORel", pFilters, pFilterGlobal)
                
                var oModel = this.getOwnerComponent().getModel();
                oModel.read('/POReleaseSet', {
                    success: function (data, response) {
                        console.log("POReleaseSet", data)
                        if (data.results.length > 0) {
                            data.results.sort(function(a,b) {
                                return new Date(b.PODATE) - new Date(a.PODATE);
                            });

                            data.results.forEach(item => {
                                if (item.PODATE !== null)
                                    item.PODATE = dateFormat.format(item.PODATE);
                            })

                            var aFilterTab = [];
                            if (_this.getView().byId("poRelTab").getBinding("rows")) {
                                aFilterTab = _this.getView().byId("poRelTab").getBinding("rows").aFilters;
                            }

                            var oJSONModel = new sap.ui.model.json.JSONModel();
                            oJSONModel.setData(data);
                            _this.getView().setModel(oJSONModel, "poRel");
                            _this._tableRendered = "poRelTab";

                            _this.onFilterBySmart(pFilters, pFilterGlobal, aFilterTab);

                            // _this.getView().getModel("ui").setProperty("/activeTransNo", data.results[0].TRANSNO);
                            // _this.getView().getModel("ui").setProperty("/activeTransItm", data.results[0].TRANSITM);
                            // _this.getView().getModel("ui").setProperty("/activePlantCd", data.results[0].PLANTCD);
                            // _this.getView().getModel("ui").setProperty("/activeMatNo", data.results[0].MATNO);
                            // _this.getView().getModel("ui").setProperty("/activeHdrRowPath", "/results/0");
                            // _this.getView().getModel("ui").setProperty("/rowCountMrpHdr", data.results.length.toString());

                            _this.setRowReadMode("poRel");
                        }

                        var oTable = _this.getView().byId("poRelTab");
                        oTable.getColumns().forEach((col, idx) => {   
                            if (col._oSorter) {
                                oTable.sort(col, col.mProperties.sortOrder === "Ascending" ? SortOrder.Ascending : SortOrder.Descending, true);
                            }
                        });
                        
                        _this.closeLoadingDialog();
                    },
                    error: function (err) { 
                        console.log("error", err)
                        _this.closeLoadingDialog();
                    }
                })
            },

            onFilterBySmart(pFilters, pFilterGlobal, pFilterTab) {
                var oFilter = null;
                var aFilter = [];
                var aFilter2 = [];
                var aFilterGrp = [];
                var aFilterCol = [];

                if (pFilters.length > 0) {
                    if (pFilters[0].aFilters) {
                        pFilters[0].aFilters.forEach((x, iIdx) => {
                            if (Object.keys(x).includes("aFilters")) {
                                x.aFilters.forEach(y => {
                                    var sName = _this._aColumns["poRel"].filter(item => item.name.toUpperCase() == y.sPath.toUpperCase())[0].name;
                                    aFilter.push(new Filter(sName, FilterOperator.Contains, y.oValue1));

                                    //if (!aFilterCol.includes(sName)) aFilterCol.push(sName);
                                });
                                var oFilterGrp = new Filter(aFilter, false);
                                aFilterGrp.push(oFilterGrp);
                                aFilter = [];
                            } else if ([...new Set(pFilters[0].aFilters.map((item) => item.sPath))].length == 1) {
                                aFilter2.push(new Filter(x.sPath, FilterOperator.Contains, x.oValue1));
                                if (iIdx == pFilters[0].aFilters.length - 1) {
                                    var oFilterGrp = new Filter(aFilter2, false);
                                    aFilterGrp.push(oFilterGrp);
                                    aFilter2 = [];
                                }
                            } else {
                                var sName = _this._aColumns["poRel"].filter(item => item.name.toUpperCase() == x.sPath.toUpperCase())[0].name;
                                aFilter.push(new Filter(sName, FilterOperator.Contains, x.oValue1));
                                var oFilterGrp = new Filter(aFilter, false);
                                aFilterGrp.push(oFilterGrp);
                                aFilter = [];

                                //if (!aFilterCol.includes(sName)) aFilterCol.push(sName);
                            }
                        });
                    } else {
                        var sName = pFilters[0].sPath;
                        aFilter.push(new Filter(sName, FilterOperator.EQ,  pFilters[0].oValue1));
                        var oFilterGrp = new Filter(aFilter, false);
                        aFilterGrp.push(oFilterGrp);
                        aFilter = [];
                    }
                }

                if (pFilterGlobal) {
                    this._aFilterableColumns["poRel"].forEach(item => {
                        var sDataType = this._aColumns["poRel"].filter(col => col.name === item.name)[0].type;
                        if (sDataType === "Edm.Boolean") aFilter.push(new Filter(item.name, FilterOperator.EQ, pFilterGlobal));
                        else aFilter.push(new Filter(item.name, FilterOperator.Contains, pFilterGlobal));
                    })

                    var oFilterGrp = new Filter(aFilter, false);
                    aFilterGrp.push(oFilterGrp);
                    aFilter = [];
                }

                // Release Group Custom
                var sSelectedKeyRelGrp = this.getView().byId("cmbRelGrp").getSelectedKey();
                if (sSelectedKeyRelGrp) {
                    aFilter.push(new Filter("RELGRP", FilterOperator.Contains, sSelectedKeyRelGrp));
                    var oFilterGrp = new Filter(aFilter, false);
                    aFilterGrp.push(oFilterGrp);
                    aFilter = [];
                }
                
                // Release Code Custom
                var sSelectedKeyRelCd = this.getView().byId("cmbRelCd").getSelectedKey();
                if (sSelectedKeyRelCd) {
                    aFilter.push(new Filter("RELCD", FilterOperator.Contains, sSelectedKeyRelCd));
                    var oFilterGrp = new Filter(aFilter, false);
                    aFilterGrp.push(oFilterGrp);
                    aFilter = [];
                }
                
                // if (aFilterGrp.length == 0) oFilter = new Filter(aFilter, false);
                // else oFilter = new Filter(aFilterGrp, true);

                oFilter = new Filter(aFilterGrp, true);

                this.byId("poRelTab").getBinding("rows").filter(oFilter, "Application");

                
                if (pFilterTab.length > 0) {
                    pFilterTab.forEach(item => {
                        var iColIdx = _this._aColumns["poRel"].findIndex(x => x.name == item.sPath);
                        _this.getView().byId("poRelTab").filter(_this.getView().byId("poRelTab").getColumns()[iColIdx], 
                            item.oValue1);
                    });
                }
            },

            onRelease(pType) {
                _this.showLoadingDialog("Executing...");
                var oTable = this.byId("poRelTab");
                var aSelIdx = oTable.getSelectedIndices();

                if (aSelIdx.length === 0) {
                    MessageBox.information(_oCaption.INFO_NO_SELECTED);
                    _this.closeLoadingDialog();
                    return;
                }

                var oModel = this.getOwnerComponent().getModel("ZGW_3DERP_LOCK_SRV");
                var aPOItem = [];

                var aData = this.getView().getModel("poRel").getData().results;
                //console.log("aIndeces", oTable.getBinding("rows"))
                var aIndices = oTable.getBinding("rows").aIndices;

                aSelIdx.forEach(idx => {
                    if ((pType == "CANCEL" || pType == "REJECT") && aData[aIndices[idx]].WITHGR != "X") {
                        aPOItem.push({
                            "Pono": aData[aIndices[idx]].PONO
                        })
                    } else if (pType == "RELEASE") {
                        aPOItem.push({
                            "Pono": aData[aIndices[idx]].PONO,
                            "RelCode": aData[aIndices[idx]].RELCD
                        })
                    }
                })

                if (aPOItem.length === 0) {
                    MessageBox.information(_oCaption.INFO_SEL_PO_WITHGR);
                    _this.closeLoadingDialog();
                    return;
                }

                var aParamLockPO = [];
                aPOItem.forEach(item => {
                    aParamLockPO.push({
                        Pono: item.Pono
                    })
                });

                var oParam = {
                    "N_LOCK_PO_ITEMTAB": aParamLockPO,
                    "iv_count": 300, 
                    "N_LOCK_PO_ENQ": [], 
                    "N_LOCK_PO_OUTMESSAGES": [] 
                }

                oModel.create("/Lock_POHdr_Set", oParam, {
                    method: "POST",
                    success: function(data, oResponse) {
                        console.log("Lock_POHdr_Set", data);

                        if (data.N_LOCK_PO_OUTMESSAGES.results.filter(x => x.Type != "S").length == 0) {
                            // Unlock first before release, reset, change PO to not encounter error
                            _this.onUnlock(aPOItem, pType);

                            // if (pType == "RELEASE") {
                            //     _this.onRelSave(aPOItem);
                            // } else if (pType == "CANCEL") {
                            //     _this.onCancelRelSave(aPOItem);
                            // } else if (pType == "REJECT") {
                            //     _this.onRejectSave(aPOItem);
                            // }
                        } else {
                            var oFilter = data.N_LOCK_PO_OUTMESSAGES.results.filter(x => x.Type != "S")[0];
                            MessageBox.warning(oFilter.Message);
                            _this.closeLoadingDialog();
                        }
                        
                    },
                    error: function(err) {
                        MessageBox.error(err);
                        _this.closeLoadingDialog();
                    }
                });
            },

            onRelSave(pPOList) {
                var aPOItem = [];
                pPOList.forEach(item => {
                    aPOItem.push({
                        Purchaseorder: item.Pono,
                        PoRelCode: item.RelCode,
                        UseExceptions: "X",
                        NoCommit: ""
                    });
                })

                var oParam = {
                    "N_POREL_IMPTAB": aPOItem,
                    "N_POREL_RETTAB": []
                }

                console.log("PO_ReleaseSet Param", oParam)

                var oModel = _this.getOwnerComponent().getModel();
                var oModelRFC = _this.getOwnerComponent().getModel("ZGW_3DERP_RFC_SRV");
                oModel.create("/PO_ReleaseSet", oParam, {
                    method: "POST",
                    success: function(data, oResponse) {
                        console.log("PO_ReleaseSet", data);
                        //_this.onUnlock(pPOList);
                        _this.closeLoadingDialog();
                        _this._aPOResultData = data.N_POREL_RETTAB.results;
                        _this.showPOResultDialog();
                        
                        _this._aPOResultData.forEach(item => {
                            if (item.RelIndicatorNew == "1") {
                                var param = {
                                    EBELN: item.Purchaseorder
                                };

                                oModel.create("/POReleaseTblSet", param, {
                                    method: "POST",
                                    success: function(data, oResponse) {
                                        console.log("POReleaseTblSet create", data);
                                    },
                                    error: function(err) {
                                        console.log("error", err);
                                    }
                                });

                                var paramVendor = {
                                    "Show_Error": "X", 
                                    "N_IT_INTVPO": [{ 
                                        "Ebeln": item.Purchaseorder, 
                                        "Userid": _startUpInfo.id
                                    }] 
                                }

                                oModelRFC.create("/Update_VendorPOSet", paramVendor, {
                                    method: "POST",
                                    success: function(data, oResponse) {
                                        console.log("Update_VendorPOSet create", data);
                                    },
                                    error: function(err) {
                                        console.log("error", err);
                                    }
                                });
                            }
                        }) 
                    },
                    error: function(err) {
                        //_this.onUnlock(pPOList);
                        MessageBox.error(err);
                        _this.closeLoadingDialog();
                    }
                });
            },

            onCancelRelSave(pPOList) {
                var aPOItem = [];
                pPOList.forEach(item => {
                    aPOItem.push({
                        Purchaseorder: item.Pono,
                        PoRelCode: "00",
                        UseExceptions: "X"
                    });
                })

                var oParam = {
                    "N_PORETRELEASE_IMPTAB": aPOItem,
                    "N_PORETRELEASE_RETTAB": []
                }

                console.log("PO_ResetReleaseSet Param", oParam)
                var oModel = _this.getOwnerComponent().getModel("ZGW_3DERP_RFC_SRV");
                oModel.create("/PO_ResetReleaseSet", oParam, {
                    method: "POST",
                    success: function(data, oResponse) {
                        console.log("PO_ResetReleaseSet", data);
                        //_this.onUnlock(pPOList);
                        _this.closeLoadingDialog();
                        _this._aPOResultData = data.N_PORETRELEASE_RETTAB.results;
                        _this.showPOResultDialog();
                        
                    },
                    error: function(err) {
                        //_this.onUnlock(pPOList);
                        MessageBox.error(err);
                        _this.closeLoadingDialog();
                    }
                });
            },

            onRejectSave(pPOList) {
                var oModel = _this.getOwnerComponent().getModel();
                var oModelRfc = _this.getOwnerComponent().getModel("ZGW_3DERP_RFC_SRV");
                var sMessage = "";

                pPOList.forEach((item, idxPO) => {
                    oModel.read("/POItemSet", {
                        urlParameters: {
                            "$filter": "PONO eq '" + item.Pono + "'"
                        },
                        success: function (data, response) {
                            console.log("POItemSet", data);
                            var aPOItem = []
                            data.results.forEach(poItem => {
                                aPOItem.push({
                                    Bedat: sapDateFormat.format(new Date(poItem.PODATE)) + "T00:00:00",
                                    Bsart: poItem.DOCTYPE,
                                    Banfn: poItem.PRNO,
                                    Bnfpo: poItem.PRITEM,
                                    Ebeln: poItem.PONO,
                                    Ebelp: poItem.POITEM,
                                    Bukrs: poItem.CURRENCY,
                                    Werks: poItem.PURCHPLANT,
                                    Unsez: poItem.SHIPTOPLANT,
                                    Menge: poItem.QTY,
                                    Meins: poItem.UOM,
                                    Netpr: poItem.NETPRICE,
                                    Peinh: poItem.PER,
                                    Bprme: poItem.ORDERPRICEUNIT,
                                    Repos: poItem.IRIND,
                                    Webre: poItem.GRBASEDIV,
                                    Eindt: sapDateFormat.format(new Date(poItem.DELDT)) + "T00:00:00",
                                    Uebto: poItem.OVERDELTOL,
                                    Untto: poItem.UNDERDELTOL,
                                    Uebtk: poItem.UNLIMITED,
                                    DeleteRec: true
                                })
                            })

                            var oParam = {
                                IPoNumber: item.Pono,
                                IDoDownload: "N",
                                IChangeonlyHdrplants: "N",
                                N_ChangePOAddtlDtlsParam: [],
                                N_ChangePOClosePRParam: [],
                                N_ChangePOCondHdrParam: [],
                                N_ChangePOCondParam: [],
                                N_ChangePOHdrTextParam: [],
                                N_ChangePOItemParam: aPOItem,
                                N_ChangePOItemSchedParam: [],
                                N_ChangePOItemTextParam: [],
                                N_ChangePOReturn: []
                            }

                            setTimeout(() => {
                                console.log("ChangePOSet Param", oParam);
                                oModelRfc.create("/ChangePOSet", oParam, {
                                    method: "POST",
                                    success: function(data, oResponse) {
                                        console.log("ChangePOSet", data);
                                        if (data.N_ChangePOReturn.results.length > 0) {
                                            sMessage += data.N_ChangePOReturn.results[0].Msgv1 + "\n";
                                            console.log("sMessage", sMessage)
                                        }
                                        
                                        if (idxPO == (pPOList.length - 1)) {
                                            //_this.onUnlock(pPOList);
                                            _this.closeLoadingDialog();
                                            MessageBox.information(sMessage);
                                            _this.onRefresh();
                                        }
                                    },
                                    error: function(err) {
                                        if (idxPO == (pPOList.length - 1)) {
                                            //_this.onUnlock(pPOList);
                                            MessageBox.error(err);
                                            _this.closeLoadingDialog();
                                        }
                                    }
                                });
                            }, 100);
                        },
                        error: function (err) {
                            _this.closeLoadingDialog();
                        }
                    })
                })
            },

            onUnlock(pPOList, pType) {
                var oModel = this.getOwnerComponent().getModel("ZGW_3DERP_LOCK_SRV");

                var aParamUnLockPO = [];
                pPOList.forEach(item => {
                    aParamUnLockPO.push({
                        Pono: item.Pono
                    })
                });
                var oParam = {
                    "N_UNLOCK_PO_ITEMTAB": aParamUnLockPO,
                    "N_UNLOCK_PO_ENQ": [], 
                    "N_UNLOCK_PO_MESSAGES": [] 
                }

                oModel.create("/Unlock_POHdr_Set", oParam, {
                    method: "POST",
                    success: function(data, oResponse) {
                        console.log("Unlock_POHdr_Set", data)
                        if (pType == "RELEASE") {
                            _this.onRelSave(pPOList);
                        } else if (pType == "CANCEL") {
                            _this.onCancelRelSave(pPOList);
                        } else if (pType == "REJECT") {
                            _this.onRejectSave(pPOList);
                        }

                        //_this.closeLoadingDialog();
                    },
                    error: function(err) {
                        MessageBox.error(err);
                        _this.closeLoadingDialog();
                    }
                });
            },

            onRefresh() {
                this.onSearch();
            },

            showPOResultDialog() {
                if (!this._POResultDialog) {
                    this._POResultDialog = sap.ui.xmlfragment("zuiporel.view.fragments.POResultDialog", this);

                    this._POResultDialog.setModel(
                        new JSONModel({
                            items: this._aPOResultData,
                            rowCount: this._aPOResultData.length
                        })
                    )

                    this.getView().addDependent(this._POResultDialog);
                }
                else {
                    this._POResultDialog.getModel().setProperty("/items", this._aPOResultData);
                    this._POResultDialog.getModel().setProperty("/rowCount", this._aPOResultData.length);
                }

                this._POResultDialog.setTitle("PO Release Result")
                this._POResultDialog.open();
            },

            onPOResultDialogClose: function(oEvent) {
                this._POResultDialog.close();
                _this.onRefresh();
            },

            setRowReadMode(arg) {
                var oTable = this.byId(arg + "Tab");
                oTable.getColumns().forEach((col, idx) => {                    
                    this._aColumns[arg].filter(item => item.label === col.getLabel().getText())
                        .forEach(ci => {
                            if (ci.type === "STRING" || ci.type === "NUMBER") {
                                col.setTemplate(new sap.m.Text({
                                    text: "{" + arg + ">" + ci.name + "}",
                                    wrapping: false,
                                    tooltip: "{" + arg + ">" + ci.name + "}"
                                }));
                            }
                            else if (ci.type === "BOOLEAN") {
                                col.setTemplate(new sap.m.CheckBox({selected: "{" + arg + ">" + ci.name + "}", editable: false}));
                            }

                            if (ci.required) {
                                col.getLabel().removeStyleClass("requiredField");
                            }
                        })
                })
            },

            createViewSettingsDialog: function (arg1, arg2) {
                var sDialogFragmentName = null;

                if (arg1 === "sort") sDialogFragmentName = "zuiporel.view.fragments.SortDialog";
                else if (arg1 === "filter") sDialogFragmentName = "zuiporel.view.fragments.FilterDialog";
                else if (arg1 === "column") sDialogFragmentName = "zuiporel.view.fragments.ColumnDialog";

                var oViewSettingsDialog = this._oViewSettingsDialog[sDialogFragmentName];

                if (!oViewSettingsDialog) {
                    oViewSettingsDialog = sap.ui.xmlfragment(sDialogFragmentName, this);
                    
                    if (Device.system.desktop) {
                        oViewSettingsDialog.addStyleClass("sapUiSizeCompact");
                    }

                    oViewSettingsDialog.setModel(arg2);

                    this._oViewSettingsDialog[sDialogFragmentName] = oViewSettingsDialog;
                    this.getView().addDependent(oViewSettingsDialog);
                }
            },
            
            getConnector(args) {
                var oConnector;

                switch (args) {
                    case "EQ":
                        oConnector = sap.ui.model.FilterOperator.EQ
                        break;
                      case "Contains":
                        oConnector = sap.ui.model.FilterOperator.Contains
                        break;
                      default:
                        // code block
                        break;
                }

                return oConnector;
            },

            onColSortCellClick: function (oEvent) {
                this._oViewSettingsDialog["zuiporel.view.fragments.SortDialog"].getModel().setProperty("/activeRow", (oEvent.getParameters().rowIndex));
            },

            onColSortSelectAll: function(oEvent) {
                var oDialog = this._oViewSettingsDialog["zuiporel.view.fragments.SortDialog"];               
                oDialog.getContent()[0].addSelectionInterval(0, oDialog.getModel().getData().rowCount - 1);
            },

            onColSortDeSelectAll: function(oEvent) {
                var oDialog = this._oViewSettingsDialog["zuiporel.view.fragments.SortDialog"];               
                oDialog.getContent()[0].removeSelectionInterval(0, oDialog.getModel().getData().rowCount - 1);
            },

            onColSortRowFirst: function(oEvent) {
                var oDialog = this._oViewSettingsDialog["zuiporel.view.fragments.SortDialog"];
                var iActiveRow = oDialog.getModel().getData().activeRow;

                var oDialogData = this._oViewSettingsDialog["zuiporel.view.fragments.SortDialog"].getModel().getData().items;
                oDialogData.filter((item, index) => index === iActiveRow)
                    .forEach(item => item.position = 0);
                oDialogData.filter((item, index) => index !== iActiveRow)
                    .forEach((item, index) => item.position = index + 1);
                oDialogData.sort((a,b) => (a.position > b.position ? 1 : -1));

                oDialog.getModel().setProperty("/items", oDialogData);
                oDialog.getModel().setProperty("/activeRow", iActiveRow - 1);
            },

            onColSortRowUp: function(oEvent) {
                var oDialog = this._oViewSettingsDialog["zuiporel.view.fragments.SortDialog"];
                var iActiveRow = oDialog.getModel().getData().activeRow;

                var oDialogData = oDialog.getModel().getData().items;
                oDialogData.filter((item, index) => index === iActiveRow).forEach(item => item.position = iActiveRow - 1);
                oDialogData.filter((item, index) => index === iActiveRow - 1).forEach(item => item.position = item.position + 1);
                oDialogData.sort((a,b) => (a.position > b.position ? 1 : -1));

                oDialog.getModel().setProperty("/items", oDialogData);
                oDialog.getModel().setProperty("/activeRow", iActiveRow - 1);
            },

            onColSortRowDown: function(oEvent) {
                var oDialog = this._oViewSettingsDialog["zuiporel.view.fragments.SortDialog"];
                var iActiveRow = oDialog.getModel().getData().activeRow;

                var oDialogData = oDialog.getModel().getData().items;
                oDialogData.filter((item, index) => index === iActiveRow).forEach(item => item.position = iActiveRow + 1);
                oDialogData.filter((item, index) => index === iActiveRow + 1).forEach(item => item.position = item.position - 1);
                oDialogData.sort((a,b) => (a.position > b.position ? 1 : -1));

                oDialog.getModel().setProperty("/items", oDialogData);
                oDialog.getModel().setProperty("/activeRow", iActiveRow + 1);
            },

            onColSortRowLast: function(oEvent) {
                var oDialog = this._oViewSettingsDialog["zuiporel.view.fragments.SortDialog"];
                var iActiveRow = oDialog.getModel().getData().activeRow;

                var oDialogData = oDialog.getModel().getData().items;
                oDialogData.filter((item, index) => index === iActiveRow)
                    .forEach(item => item.position = oDialogData.length - 1);
                    oDialogData.filter((item, index) => index !== iActiveRow)
                    .forEach((item, index) => item.position = index);
                    oDialogData.sort((a,b) => (a.position > b.position ? 1 : -1));

                oDialog.getModel().setProperty("/items", oDialogData);
                oDialog.getModel().setProperty("/activeRow", iActiveRow - 1);
            },

            onColPropSelectAll: function(oEvent) {
                var oDialog = this._oViewSettingsDialog["zuiporel.view.fragments.ColumnDialog"];               
                oDialog.getContent()[0].addSelectionInterval(0, oDialog.getModel().getData().rowCount - 1);
            },

            onColPropDeSelectAll: function(oEvent) {
                var oDialog = this._oViewSettingsDialog["zuiporel.view.fragments.ColumnDialog"];               
                oDialog.getContent()[0].removeSelectionInterval(0, oDialog.getModel().getData().rowCount - 1);
            },

            onColumnProp: function(oEvent) {
                var aColumns = [];
                var oTable = oEvent.getSource().oParent.oParent;
                
                oTable.getColumns().forEach(col => {
                    aColumns.push({
                        name: col.getProperty("sortProperty"), 
                        label: col.getLabel().getText(),
                        position: col.getIndex(), 
                        selected: col.getProperty("visible")
                    });
                })
                
                var oDialog = this._oViewSettingsDialog["zuiporel.view.fragments.ColumnDialog"];
                oDialog.getModel().setProperty("/table", oTable.getBindingInfo("rows").model);
                oDialog.getModel().setProperty("/items", aColumns);
                oDialog.getModel().setProperty("/rowCount", aColumns.length);
                oDialog.open();
            },

            beforeOpenColProp: function(oEvent) {
                oEvent.getSource().getModel().getData().items.forEach(item => {
                    if (item.selected) {
                        oEvent.getSource().getContent()[0].addSelectionInterval(item.position, item.position);
                    }
                    else {
                        oEvent.getSource().getContent()[0].removeSelectionInterval(item.position, item.position);
                    }
                })
            },            

            onColumnPropConfirm: function(oEvent) {
                var oDialog = this._oViewSettingsDialog["zuiporel.view.fragments.ColumnDialog"];
                var oDialogTable = oDialog.getContent()[0];
                var aSelRows = oDialogTable.getSelectedIndices();

                if (aSelRows.length === 0) {
                    MessageBox.information(_oCaption.INFO_SEL_ONE_COL);
                }
                else {
                    oDialog.close();
                    var sTable = oDialog.getModel().getData().table;
                    var oTable = this.byId(sTable + "Tab");
                    var oColumns = oTable.getColumns();

                    oColumns.forEach(col => {
                        if (aSelRows.filter(item => item === col.getIndex()).length === 0) {
                            col.setVisible(false);
                        }
                        else col.setVisible(true);
                    })
                }
            },

            onColumnPropCancel: function(oEvent) {
                this._oViewSettingsDialog["zuiporel.view.fragments.ColumnDialog"].close();
            },

            onSorted: function(oEvent) {
                var sColumnName = oEvent.getParameters().column.getProperty("sortProperty");
                var sSortOrder = oEvent.getParameters().sortOrder;
                var bMultiSort = oEvent.getParameters().columnAdded;
                var oSortData = this._aSortableColumns[oEvent.getSource().getBindingInfo("rows").model];

                if (!bMultiSort) {
                    oSortData.forEach(item => {
                        if (item.name === sColumnName) {
                            item.sorted = true;
                            item.sortOrder = sSortOrder;
                        }
                        else {
                            item.sorted = false;
                        } 
                    })
                }
            },

            onColSort: function(oEvent) {
                var oTable = oEvent.getSource().oParent.oParent;               
                var aSortableColumns = this._aSortableColumns[oTable.getBindingInfo("rows").model];

                var oDialog = this._oViewSettingsDialog["zuiporel.view.fragments.SortDialog"];
                oDialog.getModel().setProperty("/table", oTable.getBindingInfo("rows").model);
                oDialog.getModel().setProperty("/items", aSortableColumns);
                oDialog.getModel().setProperty("/rowCount", aSortableColumns.length);
                oDialog.open();
            },

            beforeOpenColSort: function(oEvent) {
                oEvent.getSource().getContent()[0].removeSelectionInterval(0, oEvent.getSource().getModel().getData().items.length - 1);
                oEvent.getSource().getModel().getData().items.forEach(item => {
                    if (item.sorted) {                       
                        oEvent.getSource().getContent()[0].addSelectionInterval(item.position, item.position);
                    }
                })
            },

            onColSortConfirm: function(oEvent) {
                var oDialog = this._oViewSettingsDialog["zuiporel.view.fragments.SortDialog"];
                oDialog.close();

                var sTable = oDialog.getModel().getData().table;
                var oTable = this.byId(sTable + "Tab");
                var oDialogData = oDialog.getModel().getData().items;
                var oDialogTable = oDialog.getContent()[0];
                var aSortSelRows = oDialogTable.getSelectedIndices();

                oDialogData.forEach(item => item.sorted = false);

                if (aSortSelRows.length > 0) {
                    oDialogData.forEach((item, idx) => {
                        if (aSortSelRows.filter(si => si === idx).length > 0) {
                            var oColumn = oTable.getColumns().filter(col => col.getProperty("sortProperty") === item.name)[0];
                            oTable.sort(oColumn, item.sortOrder === "Ascending" ? SortOrder.Ascending : SortOrder.Descending, true);
                            item.sorted = true;
                        }
                    })
                }

                this._aSortableColumns[sTable] = oDialogData;
            },

            onColSortCancel: function(oEvent) {
                this._oViewSettingsDialog["zuiporel.view.fragments.SortDialog"].close();
            },

            onColFilter: function(oEvent) {
                var oTable = oEvent.getSource().oParent.oParent               
                var aFilterableColumns = this._aFilterableColumns[oTable.getBindingInfo("rows").model];

                var oDialog = this._oViewSettingsDialog["zuiporel.view.fragments.FilterDialog"];
                oDialog.getModel().setProperty("/table", oTable.getBindingInfo("rows").model);
                oDialog.getModel().setProperty("/items", aFilterableColumns);
                oDialog.getModel().setProperty("/rowCount", aFilterableColumns.length);
                oDialog.open();
            },

            onColFilterConfirm: function(oEvent) {
                var oDialog = this._oViewSettingsDialog["zuiporel.view.fragments.FilterDialog"];
                oDialog.close();

                var bFilter = false;
                var aFilter = [];
                var oFilter = null;
                var sTable = oDialog.getModel().getData().table;
                var oDialogData = oDialog.getModel().getData().items;

                oDialogData.forEach(item => {
                    if (item.value !== "") {
                        bFilter = true;
                        aFilter.push(new Filter(item.name, this.getConnector(item.connector), item.value))
                    }
                })

                this.byId(sTable + "Tab").getBinding("rows").filter(oFilter, "Application");
                this._aFilterableColumns[sTable] = oDialogData;
            },

            onColFilterCancel: function(oEvent) {
                this._oViewSettingsDialog["zuiporel.view.fragments.FilterDialog"].close();
            },

            onKeyUp(oEvent) {
                if ((oEvent.key === "ArrowUp" || oEvent.key === "ArrowDown") && oEvent.srcControl.sParentAggregationName === "rows") {
                    var oTable = this.byId(oEvent.srcControl.sId).oParent;

                    if (oTable.getId().indexOf("poRelTab") >= 0) {
                        if (this.byId(oEvent.srcControl.sId).getBindingContext("poRel")) {
                            var sRowPath = this.byId(oEvent.srcControl.sId).getBindingContext("poRel").sPath;
                            
                            oTable.getModel("poRel").getData().results.forEach(row => row.ACTIVE = "");
                            oTable.getModel("poRel").setProperty(sRowPath + "/ACTIVE", "X"); 
                            
                            oTable.getRows().forEach(row => {
                                if (row.getBindingContext("poRel") && row.getBindingContext("poRel").sPath.replace("/results/", "") === sRowPath.replace("/results/", "")) {
                                    row.addStyleClass("activeRow");
                                }
                                else row.removeStyleClass("activeRow")
                            })
                        }
                    }
                }
            },

            showLoadingDialog(arg) {
                if (!_this._LoadingDialog) {
                    _this._LoadingDialog = sap.ui.xmlfragment("zuiporel.view.fragments.LoadingDialog", _this);
                    _this.getView().addDependent(_this._LoadingDialog);
                } 
                
                _this._LoadingDialog.setTitle(arg);
                _this._LoadingDialog.open();
            },

            closeLoadingDialog() {
                _this._LoadingDialog.close();
            },

            onPrintPreview() {
                _this.showLoadingDialog("Loading...");

                var oTable = this.byId("poRelTab");
                var aSelIdx = oTable.getSelectedIndices();

                if (aSelIdx.length === 0) {
                    MessageBox.information(_oCaption.INFO_NO_RECORD_SELECT);
                    _this.closeLoadingDialog();
                    return;
                }

                var aOrigSelIdx = [];
                aSelIdx.forEach(i => {
                    aOrigSelIdx.push(oTable.getBinding("rows").aIndices[i]);
                })

                var aData = _this.getView().getModel("poRel").getData().results;
                aOrigSelIdx.forEach((i, idx) => {
                    var oData = aData[i];
                    var aPOItem = [];

                    aPOItem.push({
                        "PONo": oData.PONO
                    });

                    var oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");
                    var hashUrl = (oCrossAppNavigator && oCrossAppNavigator.hrefForExternal({
                            target: {
                                semanticObject: "ZSO_POPRINT_PRVW",
                                action: "display"
                                    },
                                params : aPOItem[0]
                            }));
                    oCrossAppNavigator.toExternal({target: {shellHash: hashUrl}});
                });
            },

            onExport(pModel) {
                var oTable = _this.getView().byId(pModel + "Tab");
                var aCols = [], aRows = [], oSettings, oSheet;
                var aParent, aChild;
                var fileName;

                var sFileName = "";
                if (pModel == "poRel") {
                    var columns = oTable.getColumns();
                    for (var i = 0; i < columns.length; i++) {
                        aCols.push({
                            label: columns[i].mProperties.filterProperty,
                            property: columns[i].mProperties.filterProperty,
                            type: 'string'
                        })
                    }

                    sFileName = "PO Release";

                    var aData = _this.getView().getModel(pModel).getData().results;
                    var aIndices = this.byId("poRelTab").getBinding("rows").aIndices;
                    aIndices.forEach(item => {
                        aRows.push(aData[item]);
                    });
                } else if (pModel == "poResult") {
                    aCols.push({
                        label: "Purchaseorder",
                        property: "Purchaseorder",
                        type: "string"
                    });

                    aCols.push({
                        label: "Message",
                        property: "Message",
                        type: "string"
                    });

                    aCols.push({
                        label: "RelStatusNew",
                        property: "RelStatusNew",
                        type: "string"
                    });

                    aCols.push({
                        label: "RelIndicatorNew",
                        property: "RelIndicatorNew",
                        type: "string"
                    });

                    sFileName = "PO Result";
                    aRows = _this._aPOResultData;
                }
                console.log("aRows", aRows)
                var date = new Date();
                fileName = sFileName + " " + date.toLocaleDateString('en-us', { year: "numeric", month: "short", day: "numeric" });

                oSettings = {
                    fileName: fileName,
                    workbook: { columns: aCols },
                    dataSource: aRows
                };

                oSheet = new Spreadsheet(oSettings);
                oSheet.build()
                    .then(function () {
                        MessageToast.show('Spreadsheet export has finished');
                    })
                    .finally(function () {
                        oSheet.destroy();
                    });
            },

            onFirstVisibleRowChanged: function (oEvent) {
                var oTable = oEvent.getSource();
                var sModel;

                if (oTable.getId().indexOf("poRelTab") >= 0) {
                    sModel = "poRel";
                }

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
                var sModel;

                if (oTable.getId().indexOf("poRelTab") >= 0) {
                    sModel = "poRel";
                }

                this.setActiveRowHighlight(sModel);
            },

            onColumnUpdated: function (oEvent) {
                var oTable = oEvent.getSource();
                var sModel;

                if (oTable.getId().indexOf("poRelTab") >= 0) {
                    sModel = "poRel";
                }

                this.setActiveRowHighlight(sModel);
            },

            setActiveRowHighlight(arg) {
                var oTable = this.byId(arg + "Tab");
                
                setTimeout(() => {
                    var iActiveRowIndex = oTable.getModel(arg).getData().results.findIndex(item => item.ACTIVE === "X");

                    oTable.getRows().forEach(row => {
                        if (row.getBindingContext(arg) && +row.getBindingContext(arg).sPath.replace("/results/", "") === iActiveRowIndex) {
                            row.addStyleClass("activeRow");
                        }
                        else row.removeStyleClass("activeRow");
                    })
                }, 1);
            },

            onCellClick: function(oEvent) {
                if (oEvent.getParameters().rowBindingContext) {
                    var oTable = oEvent.getSource(); //this.byId("ioMatListTab");
                    var sRowPath = oEvent.getParameters().rowBindingContext.sPath;
                    var sModel;

                    if (oTable.getId().indexOf("poRelTab") >= 0) {
                        sModel = "poRel";
                    }
    
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

            getCaption() {
                var oJSONModel = new JSONModel();
                var oDDTextParam = [];
                var oDDTextResult = {};
                var oModel = this.getOwnerComponent().getModel("ZGW_3DERP_COMMON_SRV");
                
                // Smart Filter
                oDDTextParam.push({CODE: "SBU"});
                oDDTextParam.push({CODE: "RELCD"});
                oDDTextParam.push({CODE: "RELGRP"});
                oDDTextParam.push({CODE: "DOCTYPE"});
                oDDTextParam.push({CODE: "PURCHORG"});
                oDDTextParam.push({CODE: "PURCHGRP"});
                oDDTextParam.push({CODE: "VENDOR"});
                oDDTextParam.push({CODE: "RELIND"});
                oDDTextParam.push({CODE: "PONO"});

                // Label
                oDDTextParam.push({CODE: "ROWS"});

                // Button
                oDDTextParam.push({CODE: "RELSAVE"});
                oDDTextParam.push({CODE: "CRELSAVE"});
                oDDTextParam.push({CODE: "REJSAVE"});
                oDDTextParam.push({CODE: "PRTPREV"});
                oDDTextParam.push({CODE: "EXPORTTOEXCEL"});
                oDDTextParam.push({CODE: "REFRESH"});

                // MessageBox
                oDDTextParam.push({CODE: "INFO_NO_SELECTED"});
                oDDTextParam.push({CODE: "INFO_SEL_PO_WITHGR"});
                
                oModel.create("/CaptionMsgSet", { CaptionMsgItems: oDDTextParam  }, {
                    method: "POST",
                    success: function(oData, oResponse) {
                        // console.log(oData.CaptionMsgItems.results)
                        oData.CaptionMsgItems.results.forEach(item => {
                            oDDTextResult[item.CODE] = item.TEXT;
                        })

                        oJSONModel.setData(oDDTextResult);
                        _this.getView().setModel(oJSONModel, "ddtext");

                        _oCaption = _this.getView().getModel("ddtext").getData();
                    },
                    error: function(err) {
                        sap.m.MessageBox.error(err);
                        _this.closeLoadingDialog();
                    }
                });
            }
        });
    });
