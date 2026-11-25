import csv, json
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics.barcode import code128
D='/usr/share/fonts/truetype/dejavu/'
pdfmetrics.registerFont(TTFont('R',D+'DejaVuSans.ttf'));pdfmetrics.registerFont(TTFont('B',D+'DejaVuSans-Bold.ttf'))
DW,DH=125*mm,75*mm
# code, SP, MRP, qty, shopify title, tag name, flag, description lines
R=[
('1-MS-VC-26-Q56-WOS-11',295,590,56,"Men's Casual Shirt for Daily & Office Wear","Men's Casual Shirt",'',
 "A versatile men's casual shirt that works for office days, outings and everyday wear. Easy to pair with jeans, chinos or formal trousers."),
('2-MS-MKI-26-Q5-IOT-11',595,1190,5,"Men's Premium Shirt for Office & Party Wear","Men's Premium Shirt",'',
 "A premium men's shirt with a clean, smart look for the office, family functions and evening outings. Pairs well with formal trousers or dark jeans."),
('3-M-UG-MTN-26-Q50-IHI-11',390,780,50,"Men's Innerwear – Soft & Comfortable Everyday Undergarment","Men's Innerwear",'',
 "Comfortable men's innerwear made for all-day wear. A soft feel and easy fit for daily use at home, work or travel."),
('4-T-MKI-26-Q106-RW-11',125,250,106,"Casual T-Shirt for Everyday Comfort","Casual T-Shirt",'Men/women/kids? not clear from SKU',
 "An easy everyday T-shirt for casual outings, home and travel. Comfortable to wear and simple to style with jeans, shorts or track pants."),
('5-T-MKI-26-Q106-RW-11',145,290,106,"Everyday T-Shirt – Comfortable Casual Wear","Everyday T-Shirt",'Men/women/kids? not clear from SKU',
 "A comfortable T-shirt for daily casual wear. Light and easy to wear for outings, home and weekend plans."),
('6-MS-MKI-26-Q45-IOT-11',595,1190,45,"Men's Premium Casual Shirt – Smart Everyday Style","Men's Premium Casual Shirt",'',
 "A premium men's casual shirt that gives a neat, smart look for work, meetings and weekend outings. Wear it tucked in or untucked."),
('7-MS-MKI-26-Q45-IOT-11',495,990,45,"Men's Smart Casual Shirt for Work & Outings","Men's Smart Casual Shirt",'',
 "A smart casual shirt for men, suited to the office, college and casual outings. Easy to pair with jeans or chinos for a sharp everyday look."),
('8-TPB-MKI-26-Q108-WSY-11',195,390,108,"Track Pants – Comfortable Joggers for Sports & Lounge","Track Pants",'TPB: is B = Boys?',
 "Comfortable track pants for sports, walking, gym, travel and lounging at home. Easy to move in and simple to pair with any T-shirt."),
('9-M-UG-MKI-26-Q54-SR-11',95,190,54,"Men's Innerwear – Breathable Daily Comfort Undergarment","Men's Innerwear",'',
 "Everyday men's innerwear built for comfort. Light and easy to wear through the day, a practical basic for every wardrobe."),
('10-LG-MKI-26-Q32-RT-11',115,230,32,"Stretchable Leggings – Comfortable Everyday Wear","Leggings",'Women or girls/kids?',
 "Stretchable leggings for comfortable everyday wear. Easy to pair with kurtas, tunics, tops and T-shirts for home, school or outings."),
('11-SHRT-MKI-26-Q21-WYH-11',145,290,21,"Casual Shirt for Everyday Wear","Casual Shirt",'SHRT = Shirt or Shorts?',
 "A simple, comfortable casual shirt for everyday wear. Easy to style for outings, travel and relaxed days."),
('12-WJ-MKI-26-Q60-WWS-11',295,590,60,"Winter Jacket – Warm Outerwear for Cold Weather","Winter Jacket",'Men/women/kids? not clear',
 "A warm winter jacket for cold mornings, evenings and travel. Easy to layer over T-shirts, shirts and sweaters."),
('13-MT-MKI-26-Q135-IHI-11',395,790,135,"Men's Casual T-Shirt – Soft Everyday Wear","Men's Casual T-Shirt",'',
 "A comfortable men's T-shirt for casual outings, gym, travel and home. Easy to pair with jeans, shorts or track pants."),
('14-SLPR-MKI-26-Q15-WWS-11',145,290,15,"Men's Sleepwear – Comfortable Night & Lounge Wear","Men's Sleepwear",'SLPR = Sleepwear or Slippers?',
 "Comfortable sleepwear for a relaxed night's sleep and easy lounging at home."),
('15-M-PNT-MKI-26-Q20-HYS-11',595,1190,20,"Men's Casual Pants – Comfortable Everyday Trousers","Men's Casual Pants",'',
 "Men's casual pants for office, outings and everyday wear. A neat look that pairs well with shirts, T-shirts and polos."),
('16-M-FML-MKI-26-Q20-HYS-11',595,1190,20,"Men's Formal Trousers – Smart Office Wear Pants","Men's Formal Trousers",'',
 "Smart formal trousers for men, made for office, meetings and formal occasions. Pair with a formal shirt for a sharp, professional look."),
('17-SHRTG-MKI-26-Q125-EH-11',125,250,125,"Casual Shirt – Comfortable Daily Wear","Casual Shirt",'SHRTG: G = Girls? Shirt or Shorts?',
 "A comfortable casual shirt for everyday use. Easy to wear for outings, travel and relaxed days."),
('18-SHRTG-MKI-26-Q125-EH-11',125,250,125,"Everyday Casual Shirt – Simple & Comfortable","Everyday Casual Shirt",'SHRTG: G = Girls? Shirt or Shorts?',
 "A simple, comfortable shirt for daily wear. Easy to style for casual outings and relaxed days."),
]
assert len(R)==18
def html(desc,title):
    return f"<p>{desc}</p><ul><li>Product: {title}</li><li>Available at Kids Surplus Hub store</li><li>Great value: up to 50% below MRP</li></ul>"
O='/mnt/user-data/outputs/'
with open(O+'KSH_18_titles_descriptions.csv','w',newline='',encoding='utf-8-sig') as f:
    w=csv.writer(f); w.writerow(['#','SKU / Barcode','Current title','New Shopify title','Tag name','Description','Selling price','MRP','Qty','Please confirm'])
    cur=["Men's Shirt","Men's Shirt","Men's Innerwear","T-Shirt","T-Shirt","Men's Shirt","Men's Shirt","Track Pants","Men's Innerwear","Leggings","Shirt","Winter Jacket","Men's T-Shirt","Sleepwear","Men's Pant","Men's Formal Trousers","Shirt","Shirt"]
    for i,r in enumerate(R): w.writerow([i+1,r[0],cur[i],r[4],r[5],r[7],r[1],r[2],r[3],r[6]])
json.dump([{'sku':r[0],'title':r[4],'html':html(r[7],r[5])} for r in R],open('/home/claude/ksh18/updates.json','w'),ensure_ascii=False)
# --- tags ---
DOT=25.4/300
def barcode(code):
    for dots in (7,6,5,4,3):
        bc=code128.Code128(code,barHeight=12*mm,barWidth=dots*DOT*mm,humanReadable=False,quiet=False)
        if bc.width+20*dots*DOT*mm<=113*mm: return bc,dots
    raise SystemExit('too long '+code)
def tag(cv,code,sp,mrp,name):
    p=6*mm
    cv.setFont('B',8); cv.drawString(p,DH-6*mm,'KIDS SURPLUS HUB')
    cv.setFont('R',10); cv.drawString(p,DH-12*mm,'Product : '+name)
    cv.setFont('R',9); cv.drawString(p,DH-17.5*mm,'SKU : '+code)
    y=DH-25*mm
    cv.setFont('B',8.5); cv.drawString(p,y,'MAXIMUM RETAIL PRICE')
    t=f'₹{mrp:.2f}'; cv.setFont('R',16); cv.setFillGray(.35); cv.drawString(p,y-8*mm,t)
    wd=pdfmetrics.stringWidth(t,'R',16); cv.setLineWidth(1.2); cv.line(p-1,y-5.6*mm,p+wd+1,y-5.6*mm); cv.setFillGray(0)
    cv.setFont('R',6.5); cv.drawString(p,y-12.5*mm,'(Inclusive of all Taxes)')
    rx=DW/2+4*mm
    cv.setFont('B',8.5); cv.drawString(rx,y,'OUR PRICE')
    cv.setFont('B',26); cv.drawString(rx,y-9.5*mm,f'₹{sp:.0f}')
    cv.setFont('R',7.5); cv.drawString(rx,y-13*mm,f'You save ₹{mrp-sp:.0f}')
    bc,dots=barcode(code); bc.drawOn(cv,(DW-bc.width)/2,22*mm)
    cv.setFont('B',9); cv.drawCentredString(DW/2,17.5*mm,code)
    cv.setLineWidth(.4); cv.line(p,15*mm,DW-p,15*mm); cv.setFont('R',5.6)
    cv.drawCentredString(DW/2,11.5*mm,'Marketed by: Kotemoda Lifestyle Pvt. Ltd.  |  Net Qty: 1 N')
    cv.drawCentredString(DW/2,8*mm,'Customer care: 9972769817  |  care@wishkaro.com')
    return bc.width/mm,dots
def build(path,copies_fn,rotate):
    cv=canvas.Canvas(path,pagesize=(DH,DW) if rotate else (DW,DH)); n=0
    for r in R:
        for _ in range(copies_fn(r)):
            if rotate: cv.saveState(); cv.translate(DH,0); cv.rotate(90)
            info=tag(cv,r[0],r[1],r[2],r[5])
            if rotate: cv.restoreState()
            cv.showPage(); n+=1
    cv.save(); return n
print('preview',build(O+'KSH_18_tags_preview.pdf',lambda r:1,False))
print('test',build(O+'KSH_18_tags_TEST_1each_75x125.pdf',lambda r:1,True))
print('full',build(O+'KSH_18_tags_ALL_75x125.pdf',lambda r:r[3],True))
for r in R:
    bc,d=barcode(r[0]); print(r[0],round(bc.width/mm,1),'mm',round(d*DOT,3),'mm module')
