import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Expense } from '../types/expense'
import { format } from 'date-fns'

export function exportExpensesToPDF(expenses: Expense[], currencySymbol: string = '$') {
  const doc = new jsPDF()

  doc.setFontSize(20)
  doc.text('Expense Report', 14, 20)

  doc.setFontSize(10)
  doc.text(`Generated on ${format(new Date(), 'MMMM dd, yyyy')}`, 14, 28)

  const total = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0)
  doc.text(`Total Expenses: ${currencySymbol}${total.toFixed(2)}`, 14, 34)

  const tableData = expenses.map(exp => [
    format(new Date(exp.date), 'MMM dd, yyyy'),
    exp.category,
    exp.description || '-',
    `${currencySymbol}${parseFloat(exp.amount.toString()).toFixed(2)}`
  ])

  autoTable(doc, {
    head: [['Date', 'Category', 'Description', 'Amount']],
    body: tableData,
    startY: 40,
    theme: 'grid',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 9,
      cellPadding: 3
    },
    columnStyles: {
      3: { halign: 'right' }
    }
  })

  doc.save(`expenses-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
}
